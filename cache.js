const db = require("./db")

let cache = {
    countries: null,
    references: null
}

async function loadCache(){

    cache.countries = await db.execute('SELECT * FROM CANDY.COUNTRY')
    cache.references = await db.execute('SELECT * FROM CANDY.candyreference')

}

module.exports = {
    load: loadCache,
    content: cache
}