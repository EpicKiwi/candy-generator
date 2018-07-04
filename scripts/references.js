const db = require("../db")
const _ = require("lodash")

function allPossibleCases(arr) {
    if (arr.length == 1) {
        return arr[0]
    } else {
        var result = [];
        var allCasesOfRest = allPossibleCases(arr.slice(1))  // recur with the rest of array
        for (var i = 0; i < allCasesOfRest.length; i++) {
            for (var j = 0; j < arr[0].length; j++) {
                result.push([arr[0][j],allCasesOfRest[i]])
            }
        }
        return result
    }
}

async function start(){
    await db.connect()

    let types = (await db.execute("SELECT name FROM candy.candytype")).rows
        .map((el) => el[0])
    let variants = (await db.execute("SELECT name FROM candy.candyvariant")).rows
        .map((el) => el[0])
    let textures = (await db.execute("SELECT name FROM candy.candytexture")).rows
        .map((el) => el[0])
    let colors = (await db.execute("SELECT name FROM candy.candycolor")).rows
        .map((el) => el[0])
    let containers = (await db.execute("SELECT name FROM candy.candycontainer")).rows
        .map((el) => el[0])

    let possibilities = allPossibleCases([types,variants,textures,colors,containers])
        .map((el) => {
            return _.flattenDeep(el)
        })

    console.log(`Inserting ${possibilities.length} possibilites`)
    let progression = 1
    for(let possibility of possibilities){
        process.stdout.write(`\r${Math.floor((progression/possibilities.length)*100)}% ${progression}/${possibilities.length}`)
        let parameters = _.flatten([progression,possibility])
        await db.execute("INSERT INTO candy.candyreference VALUES (:id,:type,:variant,:texture,:color,:container)",...parameters)
        progression++
    }
    await db.commit()
    console.log(`\nDone`)

    await db.disconnect()
}

start()