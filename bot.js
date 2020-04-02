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
    await sheet.loadCells('C3:D17')

    return sheet
}

const getCellIndex = (dayOfWeek, hour) => {
    return 6 + (dayOfWeek * 2) + (hour < 12 ? 0 : 1)
}

const updatePrice = async (dayOfWeek, hour, price, sheet) => {
    const cellIndex = getCellIndex(dayOfWeek, hour)
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

const handleTurnipPrice = async (message) => {
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

const handleSellCommand = async (message) => {
    // Determine the current time slot
    const dayOfWeek = getDayFromCreatedAt(message.createdAt)
    const hour = getHourFromCreatedAt(message.createdAt)
    const currentPriceCellIndex = getCellIndex(dayOfWeek, hour)

    let highestPrice = 0
    let highestPriceUser

    // Get the current price for all users
    for (let [key, value] of Object.entries(authorMap)) {
        const sheet = await findAndLoadSheet(value)
        const currentPriceCell = sheet.getCellByA1(`C${currentPriceCellIndex}`)

        if (currentPriceCell.value > highestPrice) {
            highestPrice = currentPriceCell.value
            highestPriceUser = value
        }
    }

    // Find the buy price of the current user
    const author = authorMap[message.author.username]
    const sheet = await findAndLoadSheet(author)

    const quanityCell = sheet.getCellByA1('D3')
    const priceCell = sheet.getCellByA1('D4')
    const quantity = quanityCell.value
    const buyPrice = priceCell.value

    if (buyPrice >= highestPrice) {
        message.channel.send(`Don't sell! If you have to, ${highestPriceUser} has the best price at ${highestPrice} bells/turnip`)
    } else {
        const diff = highestPrice - buyPrice
        const profit = diff * quantity

        message.channel.send(`If you sell to ${highestPriceUser}, you can make a profit of ${profit} bells. Their price is ${highestPrice} bells/turnip`)
    }
}

const handleBuyCommand = async (message) => {
    // Get the name of the user
    const author = authorMap[message.author.username]
    const sheet = await findAndLoadSheet(author)

    // Get the quantity and price
    const match = message.content.match(/([0-9]+) x ([0-9]+)/i)
    const quantity = match && parseInt(match[1])
    const price = match && parseInt(match[2])

    const quanityCell = sheet.getCellByA1('D3')
    const priceCell = sheet.getCellByA1('D4')
    quanityCell.value = quantity
    priceCell.value = price
    await sheet.saveUpdatedCells()

    message.react('💸')
}

client.on('ready', () => {
    initDoc()
})
 
client.on('message', (message) => {
    const mentioned = message.mentions.users.find(({username}) => username === 'turnip')

    if (mentioned && /buy/i.test(message.content)) {
        handleBuyCommand(message)
        return
    }

    if (mentioned && /sell/i.test(message.content)) {
        handleSellCommand(message)
        return
    }

    // Does this message contain a turnip price?   
    if (/[0-9]+\/t/i.test(message.content)) {
        handleTurnipPrice(message)
        return
    }
})

client.login(process.env.DISCORD_BOT_TOKEN)
