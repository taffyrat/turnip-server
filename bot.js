const Discord = require('discord.js')
const auth = require('./auth.json')
const { GoogleSpreadsheet } = require('google-spreadsheet')
 
const client = new Discord.Client()
 
const authorMap = {
    urstronaut: 'Cassie',
    aerialRansacker: 'Rachael',
    taffyrat: 'Jake',
    Ebrietas: 'Jamie',
    Rikuzi: 'Reynold'
}

let doc

const initDoc = async () => {
    const creds = require('./turnip-server-30a3d36cb6a8.json')
    doc = new GoogleSpreadsheet(auth.sheetID)
    await doc.useServiceAccountAuth(creds)
    await doc.loadInfo()
    console.log('Connected to Google Sheets')
}

const findAndUpdatePrice = async (price, author, message) => {
    let correctSheetIndex

    doc.sheetsByIndex.forEach((sheet, i) => {
        if (sheet.title === author) {
            // Setting just the ID to avoid having aync inside the forEach loop
            correctSheetIndex = i
        }
    })

    if (correctSheetIndex) {
        const sheet = doc.sheetsByIndex[correctSheetIndex]
        await sheet.loadCells('C6:C17')

        // Determine which time slot you are in
        // Get the day and time in PST from the message
        const vanLocaleString = message.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver'})
        const vanDate = new Date(vanLocaleString)

        // Day of week, 0 indexed
        const dayOfWeek = vanDate.getDay() - 1
        const hour = vanDate.getHours()

        const cellIndex = 6 + (dayOfWeek * 2) + (hour < 12 ? 0 : 1)

        const cell = sheet.getCellByA1(`C${cellIndex}`)
        cell.value = price
        await sheet.saveUpdatedCells()

        message.react(hour < 12 ? '☀️' : '🌘')
    } else {
        // Show an error message
        message.channel.send('Sorry, something went wrong')
    }
}

client.on('ready', () => {
    initDoc()
})
 
client.on('message', (message) => {
    // Does this message contain a turnip price?
    // Expected format: <some number>/t
    if (/[0-9]+\/t/i.test(message.content)) {
        // Extract the number
        const match = message.content.match(/([0-9]+)\/t/i)
        const price = match && parseInt(match[1])

        // Get the name of the user
        const author = authorMap[message.author.username]

        findAndUpdatePrice(price, author, message)
    }
})

client.login(auth.token)
