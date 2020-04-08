const fs = require('fs')
const path = require('path')

const { createChart, createPossibilityChart, createProbabilityChart } = require('./viz')
const { analyzePossibilities } = require('./predictions')

const json = fs.readFileSync('./data.json', 'utf8')
const data = JSON.parse(json)

// TODO: Actually test the functions called by bot
// Rather than calling the visualization code directly
// Mock out the discord message and all that
// Pull in an actual unit test framework

// TODO: Hardcode the test data here

const testPossibilityChart = () => {
    const user = data.users[0]
    const prices = [
        user.islandBuyPrice,
        user.islandBuyPrice,
        ...user.prices
    ]
    let possibilities = analyzePossibilities(prices)
    if (possibilities.length > 3) {
        possibilities = possibilities.slice(0, 3)
    }
    
    const promises = possibilities.map((possibility, i) => {
        // Ignore the first points because they represent the buy price
        const data = possibility.prices.slice(2)
        const filename = `${user.name}-possibilities-${i}.png`
        return createPossibilityChart(data, filename)
    })

    // TODO: Wait for these promises and check that the charts actually rendered
}

const testProbabilityChart = () => {
    const user = data.users[2]
    const prices = [
        user.islandBuyPrice,
        user.islandBuyPrice,
        ...user.prices
    ]
    let possibilities = analyzePossibilities(prices, false, 0)
    createProbabilityChart(possibilities, 'summary.png')

    // TODO: Wait for these promises and check that the charts actually rendered
}

const testGraph = () => {
    const filename = 'chart.png'
    createChart(data.users, filename)

    // TODO: Check that the chart actually rendered
}

testPossibilityChart()
testGraph()
testProbabilityChart()