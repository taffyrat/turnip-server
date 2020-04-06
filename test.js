const fs = require('fs')
const path = require('path')

const { createChart, createPossibilityChart } = require('./viz')
const { analyzePossibilities } = require('./predictions')

const json = fs.readFileSync('./data.json', 'utf8')
const data = JSON.parse(json)

// TODO: Actually test the functions called by bot
// Rather than calling the visualization code directly
// Mock out the discord message and all that
// Pull in an actual unit test framework

const testPossibilityChart = () => {
    const user = data.users[0]
    const prices = [
        user.buyPrice,
        user.buyPrice,
        ...user.prices
    ]
    let possibilities = analyzePossibilities(prices)
    if (possibilities.length > 3) {
        possibilities = possibilities.slice(0, 3)
    }
    
    const promises = possibilities.map((possibility, i) => {
        // Ignore the first points because they represent the buy price
        const data = possibility.prices.slice(2)
        const filename = path.join('.', 'charts', `${user.name}-possibilities-${i}.png`)
        return createPossibilityChart(data, filename)
    })

    // TODO: Wait for these promises and check that the charts actually rendered
}

const testGraph = () => {
    const filename = path.join('.', 'charts', 'chart.png')
    createChart(data.users, filename)

    // TODO: Check that the chart actually rendered
}

testPossibilityChart()
testGraph()