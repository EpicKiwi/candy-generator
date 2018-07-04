const generator = require("./generator")
const db = require("./db")
const chalk = require("chalk")

async function generateOrders(){
    let orderCount = Math.floor(Math.random()*3)
    for(let i = 0; i<orderCount; i++){
        await generator.generateOrder()
    }
}

async function manageProduction(){
    let productionRemaining = (await db.execute("SELECT * FROM CANDY.PRODUCTIONREMAINING ORDER BY \"date\" ASC")).rows
    let machineLoad = (await db.execute("SELECT * FROM CANDY.PRODUCTIONMANCHINELOAD")).rows

    let machines = machineLoad.reduce((acc,el) => {
        if(el[5] != null && el[1] != el[5])
            return acc
        acc.push({
            id:el[0],
            cadence: el[2],
            delay: el[3],
            load: el[4],
            variant: el[1],
            reference: el[6]
        })
        return acc
    },[])

    async function addToMachine(machine){
        let nextCreation = productionRemaining.find((row) => {
            return row[5]-row[6] > 0 && row[2] == machine.variant && (machine.reference == null || machine.reference == row[7])})
        if(!nextCreation)
            return
        let quantity = Math.min(machine.cadence-machine.load,nextCreation[5]-nextCreation[6])
        if(quantity <= 0)
            return
        let id = generator.getRandomId()
        await db.execute("INSERT INTO candy.productionbatch VALUES (:id, :qty, NULL, :mac, :ord)", id,quantity,machine.id,nextCreation[0])
        nextCreation[6] += quantity
        machine.load += quantity
        machine.reference = nextCreation[7]

        let otherMachine = machines.findIndex((el) => el != machine && el.id == machine.id)
        if(otherMachine >= 0)
            machines.splice(otherMachine,1)

        if(machine.load < machine.cadence)
            await addToMachine(machine)
    }

    for(let i = 0; i<machines.length; i++) {
        let el = machines[i]
        if (el.load >= el.cadence)
            return
        await addToMachine(el)
    }

}

async function progressProduction(){

    let waiting = (await db.execute("SELECT * FROM candy.productionbatch WHERE produced_date IS NULL")).rows

    for(let wait of waiting)
    {
        await db.execute("UPDATE candy.productionbatch SET produced_date = :dat WHERE id = :id", generator.getNow(), wait[0])
    }

    let candycount = waiting.reduce((acc,el) => acc+el[1],0)
    if(candycount > 0)
        console.log(` - ${candycount} bonbons ont été ${chalk.yellow('fabriqués')}`)

}

async function manageContainer(){
    let containmentRemaining = (await db.execute(`SELECT * 
        FROM CANDY.CONTAINMENTREMAINING 
        WHERE remaining > 0 AND ready_to_package > 0
        ORDER BY "date" ASC`)).rows
    let machineLoad = (await db.execute("SELECT * FROM CANDY.CONTAINMENTMANCHINELOAD")).rows

    let machines = machineLoad.reduce((acc,el) => {
        acc.push({
            id:el[0],
            cadence: el[2],
            delay: el[3],
            load: el[4],
            container: el[1]
        })
        return acc
    },[])

    async function addToMachine(machine){
        let nextCreation = containmentRemaining.find((row) => {
            return  row[4]-row[6] > 0 &&
                    row[5]-row[6] > 0 &&
                    row[2] == machine.container
        })
        if(!nextCreation)
            return
        let quantity = Math.min(
            machine.cadence-machine.load,
            Math.min(nextCreation[4],nextCreation[5])-nextCreation[6])
        if(quantity <= 0)
            return
        let id = generator.getRandomId()
        await db.execute("INSERT INTO candy.containmentBatch VALUES (:id, :qty, NULL, :mac, :ord)", id,quantity,machine.id,nextCreation[0])
        nextCreation[6] += quantity
        machine.load += quantity

        if(machine.load < machine.cadence)
            await addToMachine(machine)
    }

    for(let i = 0; i<machines.length; i++) {
        let el = machines[i]
        if (el.load >= el.cadence)
            return
        await addToMachine(el)
    }
}

async function progressContainer(){

    let waiting = (await db.execute("SELECT * FROM candy.containmentbatch WHERE produced_date IS NULL")).rows

    for(let wait of waiting)
    {
        await db.execute("UPDATE candy.containmentbatch SET produced_date = :dat WHERE id = :id", generator.getNow(), wait[0])
    }

    let candycount = waiting.reduce((acc,el) => acc+el[1],0)
    if(candycount > 0)
        console.log(` - ${candycount} paquets ont été ${chalk.magenta('conditionnés')}`)
}

async function manageShipping(){
    let batchCount = 0;
    let packageCount = 0;
    let ordersRemaining = await db.mapQuery(`SELECT * 
        FROM CANDY.SHIPPINGORDERREMAINING 
        WHERE remaining > 0 AND ready_to_package = quantity
        ORDER BY "date" ASC`)
    let waitingPackages = await db.mapQuery(`SELECT * 
                FROM CANDY.WAITINGPACKAGES 
                WHERE (occuped_space IS NULL AND total_space IS NULL) OR occuped_space < total_space`)
    let waitingShippings = await db.mapQuery(`SELECT * FROM CANDY.WAITINGSHIPPING`)

    for(let order of ordersRemaining){

        do {
            /* SHIPPING */

            let shipping = waitingShippings.find((el) => el.destination == order.destination &&
                el.availableSpace > 0)
            if(!shipping){
                await generator.generateShipping(order.destination)
                waitingShippings = await db.mapQuery(`SELECT * FROM CANDY.WAITINGSHIPPING`)
                shipping = waitingShippings.find((el) => el.destination == order.destination &&
                    el.availableSpace > 0)
                console.log(` - Création d'une nouvelle ${chalk.cyan('livraison')} vers ${order.destination}`)
            }

            /* PACKAGE */

            let pack = waitingPackages.find((el) => el.shipping == shipping.id &&
                (el.containerType == null || el.containerType == order.container) &&
                (el.occupedSpace == null || el.occupedSpace < el.totalSpace))

            if (!pack) {
                let pakid = (await generator.generatePackage(shipping.id)).id
                waitingPackages = await db.mapQuery(`SELECT * 
                FROM CANDY.WAITINGPACKAGES 
                WHERE (occuped_space IS NULL AND total_space IS NULL) OR occuped_space < total_space`)
                pack = waitingPackages.find((el) => el.id = pakid)
                packageCount++;
            }

            if (pack.totalSpace == null && pack.occupedSpace == null) {
                pack.occupedSpace = 0;
                pack.totalSpace = (await db.mapSingle(`  SELECT number_package
                                                    FROM candy.CANDYORDER o
                                                      JOIN candy.CANDYREFERENCE ref on o.REFERENCE = ref.ID
                                                      JOIN candy.CANDYCONTAINER cont on ref.CONTAINER = cont.NAME
                                                    WHERE o.id = :id`, order.id)).numberPackage
            }

            /* INSERTION */

            let id = generator.getRandomId()
            let quantity = Math.min(Math.min(order.quantity, order.remaining), pack.totalSpace - pack.occupedSpace)
            await db.execute("INSERT INTO candy.packagebatch VALUES (:id,:pack,:ord,:qty)",
                id, pack.id, order.id, quantity)
            batchCount += quantity;
            order.remaining -= quantity

        } while (order.remaining > 0)
    }
    if(packageCount > 0)
        console.log(` - Utilisation de ${packageCount} nouveaux ${chalk.cyan('Cartons')}`)
    if(batchCount > 0)
        console.log(` - ${chalk.cyan('Empaquetage')} de ${batchCount} elements`)

}

async function progressShipping(){
    let timeDelay = 86400000
    let waitingShippings = await db.mapQuery(`SELECT * FROM CANDY.WAITINGSHIPPING`)

    await Promise.all(waitingShippings
        .filter((el) => !(el.availableSpace > 0 || el.createdDate.getTime()+timeDelay < generator.getNow().getTime()))
        .map(async (el) => {
            let estimated_date = new Date(generator.getNow().getTime() + 86400000+Math.round((Math.random()*18000000)-9000000));
            await db.execute("UPDATE candy.shipping SET estimated_date = :dte WHERE id = :id",estimated_date,el.id)
            console.log(` - Une commande à destination de ${el.destination} à été ${chalk.cyan('expédiée')}`)
    }))
}

module.exports = {
    generateOrders,
    manageProduction,
    progressProduction,
    manageContainer,
    progressContainer,
    manageShipping,
    progressShipping
}