const oracle = require("oracledb")
const camelcase = require("camelcase")

const settings = require("./settings")
const USER = settings.user
const PASSWORD = settings.password
const CONNECTION = settings.connection

let currentConnection = null

function requireConnection(){
    if(!currentConnection) {
        throw new Error("DB connection not initialized")
    }
}

function connect(){ return new Promise((resolve, reject) => {
    return oracle.getConnection({
        user: USER,
        password: PASSWORD,
        connectString: CONNECTION
    },(err,connection) => {
        if(err) {
            return reject(err)
        }
        currentConnection = connection
        return resolve(connection)
    })
})}

function disconnect(){ return new Promise((resolve, reject) => {
    currentConnection.close((err) => {
        if(err){
            return reject(err)
        }
        currentConnection = null
        return resolve()
    })
})}

async function commit(){
    await execute("COMMIT")
}

async function rollback(){
    await execute("ROLLBACK")
}

function execute(query,...values){ return new Promise((resolve, reject) => {
    if(process.env.QUERY_DEBUG)
        console.log(`{{ ORACLE QUERY : "${query}" }}`)
    requireConnection()
    return currentConnection.execute(query,values,{},(err,result) => {
        if(err){
            return reject(err)
        }
        return resolve(result)
    })
})}

async function mapQuery(query,...values){
    let result = await execute(query,...values)
    let columns = result.metaData.map((el) => camelcase(el.name.toLowerCase()))
    return result.rows.map((el) => {
        return el.reduce((acc,elem,i) => {
            acc[columns[i]] = elem
            return acc
        },{})
    })
}

async function mapSingle(query,...values){
    return (await mapQuery(`SELECT * FROM (${query}) WHERE ROWNUM <= 1`,...values))[0]
}

async function getRandomFromTable(table,count){
    count = count+1 || 2
    return await execute("SELECT * FROM (SELECT * FROM "+table+" ORDER BY DBMS_RANDOM.VALUE) WHERE rownum<:num",count)
}

module.exports = {
    connect,
    disconnect,
    execute,
    commit,
    rollback,
    getRandomFromTable,
    mapQuery,
    mapSingle
}