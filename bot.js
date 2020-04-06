require('dotenv').config()

const { Client, MessageAttachment } = require('discord.js')

const { createChart, createPossibilityChart } = require('./viz')
const { analyzePossibilities } = require('./predictions')

const fs = require('fs')
const path = require('path')
 
const client = new Client()

let data = {
    users: []
}

const saveData = () => {
    const filename = path.join('.', 'data.json')
    fs.writeFileSync(filename, JSON.stringify(data))
}

const initDoc = async () => {
    console.log('Initializing...')

    const filename = path.join('.', 'data.json')
    if (fs.existsSync(filename)) {
        const json = fs.readFileSync(filename, 'utf8')
        data = JSON.parse(json)
    } else {
        saveData()
    }

    console.log('Initialized')
}

const getUser = (author) => data.users.find((user) => user.name === author)

const getPriceIndex = (dayOfWeek, hour) => (dayOfWeek * 2) + (hour < 12 ? 0 : 1)

const updatePrice = (dayOfWeek, hour, price, array) => {
    const index = getPriceIndex(dayOfWeek, hour)
    array[index] = price

    saveData()
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

    updatePrice(dayOfWeek, hour, price, getUser(message.author.username).prices)

    message.react(hour < 12 ? '☀️' : '🌘')
}

const handleSellCommand = async (message) => {
    // Determine the current time slot
    const dayOfWeek = getDayFromCreatedAt(message.createdAt)
    const hour = getHourFromCreatedAt(message.createdAt)
    const currentPriceIndex = getPriceIndex(dayOfWeek, hour)

    // Get the current price for all users
    let highestPrice = 0
    let highestPriceUser

    data.users.forEach((user) => {
        const price = user.prices[currentPriceIndex]
        if (price && price > highestPrice) {
            highestPrice = price
            highestPriceUser = user.name
        }
    })

    // Find the buy price of the current user
    const {buyPrice, buyQuantity} = getUser(message.author.username)

    const pricePerTurnipDiff = highestPrice - buyPrice
    const bellDelta = pricePerTurnipDiff * buyQuantity
    
    if (!buyQuantity || !buyPrice) {
        message.channel.send(`Please call the \`buy\` command before attempting to sell.`)
        return
    }

    if (buyPrice >= highestPrice) {
        message.channel.send(`Don't sell! You'll lose ${bellDelta} bells. If you have to, ${highestPriceUser} has the best price at ${highestPrice} bells/turnip`)
    } else {
        message.channel.send(`If you sell to ${highestPriceUser}, you can make a profit of ${bellDelta} bells. Their price is ${highestPrice} bells/turnip`)
    }
}

const handleBuyCommand = async (message) => {
    // Get the quantity and price from the message
    const match = message.content.match(/([0-9]+) x ([0-9]+)/i)
    const quantity = match && parseInt(match[1])
    const price = match && parseInt(match[2])

    const user = getUser(message.author.username)
    user.buyPrice = price
    user.buyQuantity = quantity

    saveData()

    message.react('💸')
    const totalBells = quantity * price
    message.channel.send(`You spent ${totalBells} bells.`)
}

const handleInfoCommand = async (message) => {
    const user = getUser(message.author.username)
    const quantity = user.buyQuantity || 0
    const price = user.buyPrice || 0

    const totalBells = quantity * price
    message.channel.send(`You bought ${quantity} turnips at ${price} per turnip, in total spent ${totalBells} bells.`)
}

const handleHelpCommand = (message) => {
    message.channel.send(
`**Buy turnips**
I'll record the number of turnips you purchased, and their price.
Format: \`\@turnip buy <number of turnips> x <price per turnip>\`
Example: \`\@turnip buy 100 x 99\`

**Record a turnip price**
By default, I'll add your price to the current time slot. If you want to specify a different time, add morning or afternoon to your message, or the day of the week.
Format: \`<price per turnip>/t\`
Examples: \`100/t\`, \`100/t morning\`, \`100/t afternoon friday\`

**Sell turnips**
I'll tell you who to sell to, and how much you'll make.
Format: \`\@turnip sell\`

**Info**
I'll tell you how many turnips you sold, how much you sold them for, and the total cost.
Format: \`@turnip info\`

**Graph**
I'll show you the current graph including the data for all users.
Format: \`@turnip graph\`
`)
}

const handleGraphCommand = async (message) => {
    const filename = path.join('.', 'charts', 'chart.png')
    await createChart(data.users, filename)

    const attachment = new MessageAttachment(filename)
    message.channel.send(attachment)
}

const handleAddUserCommand = async (message) => {
    const match = message.content.match(/add me ([A-Z]+)/i)
    const color = match && match[1]

    data.users.push({
        name: message.author.username,
        color: color,
        prices: [],
        buyPrice: 0,
        buyQuantity: 0
    })

    saveData()
}

const createAndSendPossibilityChart = async (possibility, i, user, message) => {
    // Ignore the first points because they represent the buy price
    const data = possibility.prices.slice(2)
    const filename = path.join('.', 'charts', `${user.name}-possibilities-${i}.png`)
    await createPossibilityChart(data, filename)
    const attachment = new MessageAttachment(filename)
    message.channel.send(attachment)
}

const handlePredictCommand = (message) => {
    const user = getUser(message.author.username)
    const prices = [
        user.buyPrice,
        user.buyPrice,
        ...user.prices
    ]
    const possibilities = analyzePossibilities(prices)

    if (possibilities.length >= 3) {
        message.channel.send('We don\'t have enough data to determine your pattern yet. Check back after adding some more info!')
    } else {
        message.channel.send('We can narrow your pattern down to these possibilities:')

        possibilities.forEach((possibility, i) => {
            createAndSendPossibilityChart(possibility, i, user, message)
        })
    }
}

client.on('ready', () => {
    initDoc()
})
 
client.on('message', (message) => {
    if (message.author.bot) {
        return
    }
    
    if (message.author === client.user) {
        return 
    }

    const mentioned = message.mentions.users.find(({username}) => username === 'turnip')

    if (mentioned && /buy/i.test(message.content)) {
        console.log('Received the buy command')
        handleBuyCommand(message)
        return
    }

    if (mentioned && /sell/i.test(message.content)) {
        console.log('Received the sell command')
        handleSellCommand(message)
        return
    }

    if (mentioned && /help/i.test(message.content)) {
        console.log('Received the help command')
        handleHelpCommand(message)
        return
    }
    
    if (mentioned && /info/i.test(message.content)) {
        console.log('Received the info command')
        handleInfoCommand(message)
        return
    }

    if (mentioned && /graph/i.test(message.content)) {
        console.log('Received the graph command')
        handleGraphCommand(message)
        return
    }

    if (mentioned && /add me/i.test(message.content)) {
        console.log('Received the add user command')
        handleAddUserCommand(message)
        return
    }

    if (mentioned && /predict/i.test(message.content)) {
        console.log('Received the predict command')
        handlePredictCommand(message)
        return
    }
    
    // Does this message contain a turnip price?   
    if (/[0-9]+\/t/i.test(message.content)) {
        console.log('Received the turnip command')
        handleTurnipPrice(message)
        return
    }
})

client.login(process.env.DISCORD_BOT_TOKEN)
