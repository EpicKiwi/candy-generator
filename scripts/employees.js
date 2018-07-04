const faker = require("faker")

faker.locale = "fr"

let services = [{service:"Direction",number:5},
{service:"Service de fabrication",number:15},
{service:"Service de conditionnement",number:18},
{service:"Service de préparation de commandes",number:13},
{service:"Service de gestion des stocks",number:8},
{service:"Service d'expéditions",number:9},
{service:"Service de réception",number:5},
{service:"Service des achats",number:6},
{service:"Ressources humaines",number:4},
{service:"Service Informatique",number:7},
{service:"Maintenance",number:11}]

let result = ""

services.forEach((el) => {
	for(let i = 0; i<el.number;i++){
		let name = `${faker.name.firstName()} ${faker.name.lastName()}`
		let title = faker.name.jobTitle().substr(4)
		let salary = Math.ceil(Math.random()*20)*1000
		result += `INSERT INTO EMPLOYEE VALUES ('${name}', '${title}', ${salary}, '${el.service}');\n`
	}
})

console.log(result)