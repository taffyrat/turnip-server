require('dotenv').config()

const Discord = require('discord.js')
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
    doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)
    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICES_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SERVICES_PRIVATE_KEY,
    })
    await doc.loadInfo()
    console.log('Connected to Google Sheets')
}

const findAndLoadSheet = async (author) => {
    let correctSheetIndex

    doc.sheetsByIndex.forEach((sheet, i) => {
        if (sheet.title === author) {
            // Setting just the ID to avoid having aync inside the forEach loop
            correctSheetIndex = i
        }
    })

    const sheet = doc.sheetsByIndex[correctSheetIndex]
    await sheet.loadCells('C6:C17')

    return sheet
}

const updatePrice = async (dayOfWeek, hour, price, sheet) => {
    const cellIndex = 6 + (dayOfWeek * 2) + (hour < 12 ? 0 : 1)
    const cell = sheet.getCellByA1(`C${cellIndex}`)
    cell.value = price
    await sheet.saveUpdatedCells()
}

const getLocalizedDate = (createdAt) => {
    const vanLocaleString = createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver'})
    return new Date(vanLocaleString)
}

const getDayFromCreatedAt = (createdAt) => {
    // Day of week, 0 indexed
    return getLocalizedDate(createdAt).getDay() - 1
}

const getHourFromCreatedAt = (createdAt) => {
    return getLocalizedDate(createdAt).getHours()
}

const checkContentForDay = (content) => {
    if (/monday|mon/i.test(content)) {
        return 0
    } else if (/tuesday|tues/i.test(content)) {
        return 1
    } else if (/wednesday|wed/i.test(content)) {
        return 2
    } else if (/thursday|thur/i.test(content)) {
        return 3
    } else if (/friday|fri/i.test(content)) {
        return 4
    } else if (/saturday|sat/i.test(content)) {
        return 5
    } else {
        return -1
    }
}

const handleMessage = async (message) => {
    // Extract the number
    const match = message.content.match(/([0-9]+)\/t/i)
    const price = match && parseInt(match[1])

    // Get the name of the user
    const author = authorMap[message.author.username]

    // Does this message contain a time of day?
    let hour
    if (/morning/i.test(message.content)) {
        hour = 1
    } else if (/afternoon/i.test(message.content)) {
        hour = 13
    } else {
        hour = getHourFromCreatedAt(message.createdAt)
    }

    // Does this message contain a weekday?
    let dayOfWeek = checkContentForDay(message.content)
    if (dayOfWeek === -1) {
        dayOfWeek = getDayFromCreatedAt(message.createdAt)
    }

    const sheet = await findAndLoadSheet(author)
    await updatePrice(dayOfWeek, hour, price, sheet)

    message.react(hour < 12 ? '☀️' : '🌘')
}

client.on('ready', () => {
    initDoc()
})
 
client.on('message', (message) => {
    // Does this message contain a turnip price?
    // Expected formats:
    //     <some number>/t
    //     <num>/t morning
    //     <num>/t friday morning
    if (/[0-9]+\/t/i.test(message.content)) {
        handleMessage(message)
    }
})

client.login(process.env.DISCORD_BOT_TOKEN)
