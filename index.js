const db = require("./db")
const cache = require("./cache")
const tickManager = require("./tickManager")
const generator = require("./generator")
const moment = require("moment")
const chalk = require("chalk")

const DELTATICK = 0
let tickNumber = 0

async function tick(){
    console.log(" "+chalk.grey("--- "+moment(generator.getNow()).format("HH:mm DD/MM/YY")+" ---")+"\n")

    if(!process.env.NO_ORDER) {
        await tickManager.generateOrders()
    }

    if(!process.env.NO_PRODUCTION) {
        await tickManager.progressProduction()
        await tickManager.manageProduction()
    }

    if(!process.env.NO_CONTAINER) {
        await tickManager.progressContainer()
        await tickManager.manageContainer()
    }

    if(!process.env.NO_SHIPPING) {
        await tickManager.progressShipping()
        await tickManager.manageShipping()
    }

    if(!process.env.SIMULATE) {
        await db.commit()
    }

    console.log("")
    tickNumber++
    generator.tickDate()
    setTimeout(() => tick(),DELTATICK)
}

async function start(){
    console.log("  ___   _ _____ _                 ")
    console.log(" |   \\ /_\\_   _/_\\  __ _ ___ _ _  ")
    console.log(" | |) / _ \\| |/ _ \\/ _` / -_) ' \\ ")
    console.log(" |___/_/ \\_\\_/_/ \\_\\__, \\___|_||_|")
    console.log("                   |___/          \n")

    console.log("Connexion à la base de données")
    await db.connect()
    console.log("Connecté")
    console.log("Chargement du cache")
    await cache.load()
    console.log("Cache chargé\n")
    tick()
}

process.on('SIGTERM', async () => {
    await db.disconnect()
    process.exit(0);
});

start()