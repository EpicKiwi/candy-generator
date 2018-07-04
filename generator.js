const faker = require("faker")
const cache = require("./cache")
const db = require("./db")
const chalk = require("chalk")
const fs = require("fs")

let increment = 0
//let today = new Date(2017,5,1,8,33) // 1er Juin 2017 8h31
//let today = new Date(2017,5,2,22,23)
let currentDatePath = __dirname+"/current.date"
let today = new Date()
today.setTime(fs.readFileSync(currentDatePath,"utf8"))
let timeStep = 60000

function tickDate(){
    increment = 0
    today.setTime(today.getTime()+timeStep)
    fs.writeFileSync(currentDatePath,today.getTime())
}

function getRandomId(){
    increment++
    return parseInt(increment+""+today.getTime())
}

function getNow(){
    return today
}

function getRandomElement(arr){
    return arr[Math.floor(Math.random()*arr.length)]
}

async function generateClient(){
    let id = getRandomId()
    let name = faker.name.findName()
    let email = faker.internet.email()
    let country = getRandomElement(cache.content.countries.rows)[0]
    await db.execute("INSERT INTO candy.client VALUES (:id,:name,:email,:country)",
        id,
        name,
        email,
        country)
    console.log(` - Nouveau ${chalk.blue('client')} ${name}`)
    return await db.execute("SELECT * FROM candy.client WHERE id=:id",id)
}

async function generateOrder(){
    let clientid = null

    if(Math.random() > 0.5){
        clientid = (await db.getRandomFromTable("candy.client")).rows[0][0]
    } else {
        clientid = (await generateClient()).rows[0][0]
    }

    let destination = getRandomElement(cache.content.countries.rows)[0]
    let orderId = getRandomId()
    let date = getNow()

    await db.execute("INSERT INTO candy.clientorder VALUES (:id, :dat, :dest, :cli)",orderId,date,destination,clientid)

    let lineNumber = Math.ceil(Math.random()*3)
    console.log(` - Nouvelle ${chalk.green('commande')} de ${lineNumber} références`)

    for(let i = 0; i <lineNumber; i++){
        let lineId = getRandomId()
        let reference = (await db.getRandomFromTable("candy.candyreference")).rows[0]
        if(reference[5] == 'échantillon' && Math.random() >= 0.5){
            reference = (await db.getRandomFromTable("candy.candyreference")).rows[0]
        }
        let quantity = Math.ceil(Math.random()*200)
        await db.execute("INSERT INTO candy.candyorder VALUES (:id, :qty, :ref, :ord)",lineId,quantity,reference[0],orderId)
        console.log(`    ${quantity} ${reference[1]} ${reference[4]} ${reference[2]} ${reference[3]} en ${reference[5]}`)
    }

}

async function generatePackage(shippingId){
    let id = getRandomId()
    await db.execute("INSERT INTO candy.package VALUES (:id, :shipping)",id,shippingId)
    return await db.mapSingle("SELECT * FROM candy.package WHERE id = :id",id)
}

async function generateShipping(destination){
    let id = getRandomId()
    await db.execute("INSERT INTO candy.SHIPPING (ID,DESTINATION,created_date) VALUES (:id, :dest, :dte)",id,destination,getNow())
    return await db.mapSingle("SELECT * FROM candy.SHIPPING WHERE id = :id",id)
}

module.exports = {
    getRandomId,
    generateClient,
    generateOrder,
    generatePackage,
    generateShipping,
    getNow,
    tickDate
}