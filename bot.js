require('dotenv').config()

const { Client, MessageAttachment } = require('discord.js')

const { createChart, createProbabilityChart } = require('./viz')
const { analyzePossibilities } = require('./predictions')

const fs = require('fs')
const path = require('path')
 
const client = new Client()

// Returns the ISO week of the date.
// From https://weeknumber.net/how-to/javascript
Date.prototype.getWeek = function() {
    var date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    var week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

let data = {
    users: []
}

const patterns = {
    'Unknown': -1,
    'Fluctuating': 0,
    'Big Spike': 1,
    'Decreasing': 2,
    'Small Spike': 3
}

const getDataFilename = (date = new Date()) => {
    const currentYear = date.getFullYear()
    const currentWeek = date.getWeek()
    return path.join('.', `data-${currentYear}-${currentWeek}.json`)
}

const saveData = () => {
    fs.writeFileSync(getDataFilename(), JSON.stringify(data))
}

const handleNewWeek = () => {
    data.users.forEach((user) => {
        user.previousPattern = user.currentPattern
        user.currentPattern = ''

        user.prices = []
        user.purchased = {}
        user.islandBuyPrice = 0
    })

    saveData()
}

const initDoc = () => {
    console.log('Initializing...')

    // Select a date from last week
    const lastWeekDate = new Date()
    lastWeekDate.setDate(lastWeekDate.getDate() - 7)

    if (fs.existsSync(getDataFilename())) {
        const json = fs.readFileSync(getDataFilename(), 'utf8')
        data = JSON.parse(json)
    } else if (fs.existsSync(getDataFilename(lastWeekDate))) {
        // Transfer the relevant data from last week
        // Mostly the users and their previous pattern
        const json = fs.readFileSync(getDataFilename(lastWeekDate), 'utf8')
        data = JSON.parse(json)
        handleNewWeek()
    } else {
        // Create an empty data file
        saveData()
    }

    console.log('Initialized')
}

const getUser = (author) => data.users.find((user) => user.name === author)

const getUserForMessage = (message) => {
    let username = message.author.username

    // Check if any other user is specified
    data.users.forEach(({name}) => {
        if (message.content.includes(name)) {
            username = name
        }
    })

    return getUser(username)
}

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

const handleTurnipPrice = (message) => {
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

const getHighestPossibilityForAllUsers = () => {
    const allSummaries = data.users.map((user) => {
        const summary = getSummaryForUser(user)
        summary.username = user.name
        return summary
    })

    let highestValue = 0
    let highestUsername
    let priceIndex

    // Ignore all values that have already passed
    // We only want future values
    allSummaries.forEach((summary) => {
        if (!summary.prices.length) {
            return
        }

        summary.prices.forEach(({min, max}, i) => {
            if (min === max) {
                return
            }

            if (max > highestValue) {
                highestValue = max
                highestUsername = summary.username
                priceIndex = i
            }
        })
    })

    // Get the timeslot from the index
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const isOdd = priceIndex % 2 === 1
    const day = isOdd ? days[(priceIndex - 1) / 2] : days[priceIndex/2]
    const time = isOdd ? 'afternoon' : 'morning'

    return ({
        price: highestValue,
        username: highestUsername,
        timeslot: `${day} ${time}`
    })
}

const handleSellCommand = (message) => {
    message.react('🤔')

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

    const highestPossibility = getHighestPossibilityForAllUsers()

    // Find the buy price of the current user
    const {purchased} = getUser(message.author.username)

    const pricePerTurnipDiff = highestPrice - purchased.price
    const bellDelta = pricePerTurnipDiff * purchased.quantity
    
    if (!purchased.quantity || !purchased.price) {
        message.channel.send(`Please call the \`buy\` command before attempting to sell.`)
        return
    }

    if (purchased.price >= highestPrice) {
        if (highestPrice < highestPossibility.price) {
            message.channel.send(`Don't sell! Based on my predictions, ${highestPossibility.username} may have a price as high as ${highestPossibility.price} on ${highestPossibility.timeslot}. You may want to wait until then.`)
        } else {
            message.channel.send(`Don't sell! You'll lose ${bellDelta} bells. If you have to, ${highestPriceUser} has the best price at ${highestPrice} bells/turnip`)
        }
    } else {
        message.channel.send(`If you sell to ${highestPriceUser} now, you can make a profit of ${bellDelta} bells. Their price is ${highestPrice} bells/turnip`)

        if (highestPrice < highestPossibility.price) {
            message.channel.send(`However, if you wait until ${highestPossibility.timeslot}, ${highestPossibility.username} may have a price as high as ${highestPossibility.price}.`)
        }
    }
}

const handleBuyCommand = (message) => {
    // Get the quantity and price from the message
    const match = message.content.match(/([0-9]+) x ([0-9]+)/i)
    const quantity = match && parseInt(match[1])
    const price = match && parseInt(match[2])

    const user = getUser(message.author.username)
    user.purchased = {
        price,
        quantity   
    }

    saveData()

    message.react('💸')
    const totalBells = quantity * price
    message.channel.send(`You spent ${totalBells} bells.`)
}

const handleInfoCommand = (message) => {
    const user = getUserForMessage(message)
    const quantity = user.purchased.quantity || 0
    const price = user.purchased.price || 0

    const totalBells = quantity * price
    message.channel.send(`${user.name} bought ${quantity} turnips at ${price} per turnip, spending ${totalBells} bells in total.`)
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

**Predict**
I'll attempt to predict the possible patterns for the user. If there are 5 or fewer possibilities, it will render a graph for each.

Format: \`@turnip predict\`. \`@turnip predict <username>\`


**Update your island's price**
I'll add the price of turnips for your island. This is helpful for improving the accuracy of your predictions.

Format: \`@turnip daisy <price per turnip>/t\`

**Register a user with Turnip**
I'll register you as a user so you can start tracking your turnip prices.

Format: \`@turnip add me <colorword used in CSS>\`
`)
}

const handleGraphCommand = async (message) => {
    const filename = 'chart.png'
    const filePath = await createChart(data.users, filename)

    const attachment = new MessageAttachment(filePath)
    message.channel.send(attachment)
}

const handleAddUserCommand = (message) => {
    const match = message.content.match(/add me ([A-Z]+)/i)
    const color = match && match[1]

    data.users.push({
        name: message.author.username,
        color: color,
        prices: [],
        purchased: {
            price: 0,
            quantity: 0
        },
        islandBuyPrice: 0
    })

    saveData()
}

const getSummaryForUser = (user) => {
    if (user.prices.length === 0) {
        return {prices: []}
    }

    // Replace 0s with NaN to match expected input
    const prices = [
        user.islandBuyPrice,
        user.islandBuyPrice,
        ...user.prices
    ].map((price) => price || NaN)

    const poss = analyzePossibilities(prices, false, patterns[user.previousPattern || 'Unknown'])
    return poss[poss.length - 1]
}

const getPredictionsForUser = async (user, message) => {
    if (!user.previousPattern) {
        message.channel.send(`Something went wrong. Are ${user.name}'s prices and previous pattern entered correctly?`)
        return
    }

    // Replace 0s with NaN to match expected input
    const prices = [
        user.islandBuyPrice,
        user.islandBuyPrice,
        ...user.prices
    ].map((price) => price || NaN)

    const possibilities = analyzePossibilities(prices, false, patterns[user.previousPattern  || 'Unknown'])

    // Reduce the probabilities
    const probabilityMap = possibilities.reduce((prev, curr) => {
        if (curr.pattern_description === 'All patterns') {
            return prev
        }

        const prevProb = prev[curr.pattern_description] || 0
        prev[curr.pattern_description] = prevProb + curr.probability
        return prev
    }, {})

    // Print out the probability map
    let probabilityString = ''
    for (let [key, value] of Object.entries(probabilityMap)) {
        probabilityString += `${key}: ${(value * 100).toFixed(1)}%\n`
    }

    message.channel.send(`Here are the probabilities of your possible patterns: \n${probabilityString}`)

    if (possibilities.length <= 8) {
        const filePath = await createProbabilityChart(possibilities, `${user.name}-summary.png`)
        const attachment = new MessageAttachment(filePath)
        message.channel.send(`Here's the probability distribution of your prices:`, attachment)
    }

    if (Object.keys(probabilityMap).length === 1) {
        // We've only got a single pattern
        // which means we can update this week's pattern
        user.currentPattern = Object.keys(probabilityMap)[0]
        saveData()
    }
}

const handlePredictCommand = (message) => {
    const user = getUserForMessage(message)
    getPredictionsForUser(user, message)
}

const handleDaisyCommand = (message) => {
    const match = message.content.match(/([0-9]+)\/t/i)
    const price = match && parseInt(match[1])

    const user = getUser(message.author.username)
    user.islandBuyPrice = price

    saveData()

    message.react('🐷')
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

    const mentioned = message.mentions.users.find((user) => user === client.user)

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

    if (mentioned && /daisy/i.test(message.content)) {
        console.log('Received the Daisy command')
        handleDaisyCommand(message)
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
