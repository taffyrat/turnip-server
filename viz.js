const fs = require('fs')
const path = require('path')
const { createCanvas } = require('canvas')

const findHighestPrice = (data) => {
    let highestPrice = 0

    data.forEach((entry) => {
        let userHighest = 0
        entry.prices.forEach((price) => {
            if (price > userHighest) {
                userHighest = price
            }
        })
    
        if (userHighest > highestPrice) {
            highestPrice = userHighest
        }
    })
    
    return highestPrice
}

const fillBackground = (ctx, o) => {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, o.width, o.height)
    ctx.fillStyle = 'black'
}

const renderXAxis = (ctx, o) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.lineTo(o.margin.left, o.xAxisYPosition)
    ctx.lineTo(o.width - o.margin.right, o.xAxisYPosition)
    ctx.stroke()
    
    // Label it
    ctx.font = '16px Arial'
    ctx.fillText('Time slot', o.margin.left, o.height - (o.margin.bottom / 2))
    
    const days = ['M', 'Tu', 'W', 'Th', 'F', 'S']

    for (let i = 0; i < o.xTickCount; i++) {
        const x = o.margin.left + (o.xTickDistance * i) + o.innerOffset
    
        ctx.beginPath()
        ctx.lineTo(x, o.xAxisYPosition - 10)
        ctx.lineTo(x, o.xAxisYPosition + 10)
        ctx.stroke()
    
        const isOdd = i % 2 === 1
        ctx.fillText(isOdd ? 'PM' : `${days[i / 2]} AM`, x, o.xAxisYPosition + 15)
    }
}

const setYTickUnit = (o) => {
    let t = 10

    if (o.highestPrice > 200 && o.highestPrice < 400) {
        t = 30
    } else if (o.highestPrice >= 400) {
        t = 50
    }

    o.yTickUnit = t
}

const yMap = (input, o) => {
    // Round highest price up to the nearest unit
    // To match how we're actually setting this range
    const high = (Math.ceil(o.highestPrice / o.yTickUnit) + 1) * o.yTickUnit

    const slope = (o.numberOfYTicks * o.yTickDistance) / high
    return slope * input
}

const renderYAxis = (ctx, o) => {
    // Y axis
    ctx.beginPath()
    ctx.lineTo(o.margin.left, o.margin.top)
    ctx.lineTo(o.margin.left, o.height - o.margin.bottom)
    ctx.stroke()

    // Y axis label
    ctx.fillText('b/t', 10, o.height / 2)

    ctx.textAlign = 'right'

    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    // Don't render the line for 0
    for (let i = 1; i < o.numberOfYTicks; i++) {
        const y = o.xAxisYPosition - (o.yTickDistance * i)

        ctx.beginPath()
        ctx.lineTo(o.margin.left - 10, y)
        ctx.lineTo(o.width - o.margin.right, y)
        ctx.stroke()

        ctx.fillText(i * o.yTickUnit, o.margin.left - o.innerOffset, y)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
}

const renderData = (ctx, o, data) => {
    const pointSize = 5

    ctx.textAlign = 'left'
    
    data.forEach((entry, userIndex) => {
        ctx.strokeStyle = entry.color
        ctx.fillStyle = entry.color
    
        // Render the legend entry
        const labelX = o.margin.left + (userIndex * 150)
        const labelY = o.margin.top / 2
        const labelRectSize = 10
        ctx.fillRect(labelX, labelY - labelRectSize, labelRectSize, labelRectSize)
        ctx.fillText(entry.name, labelX + labelRectSize * 1.5, labelY)
    
        // Render the data
        ctx.beginPath()
    
        entry.prices.forEach((price, i) => {
            if (!price) {
                ctx.stroke()
                ctx.beginPath()
                return
            }
    
            // TODO: Utility for determining the position or something
            const x = o.margin.left + o.innerOffset + (o.xTickDistance * i)
            const y = o.xAxisYPosition - yMap(price, o)
    
            ctx.fillRect(x - (pointSize / 2), y - (pointSize / 2), pointSize, pointSize)
            ctx.lineTo(x, y)
    
            // Label with the price
            ctx.fillText(price, x, y - 10)
        })
    
        ctx.stroke()
    })
}

const directory = 'charts'

const saveImage = async (canvas, filename) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory)
    }

    return new Promise((resolve) => {
        const filePath = path.join(directory, filename)
        const out = fs.createWriteStream(filePath)
        const stream = canvas.createPNGStream()
        stream.pipe(out)
        out.on('finish', () =>  {
            console.log('Created a new chart PNG')
            resolve(filePath)
        })
    })
}

const createChart = async (data, filename) => {
    const o = {
        width: 1000,
        height: 600,
        margin: {
            top: 100,
            right: 50,
            bottom: 100,
            left: 100
        },
        innerOffset: 20
    }

    const canvas = createCanvas(o.width, o.height)
    const ctx = canvas.getContext('2d')

    o.highestPrice = findHighestPrice(data)

    o.xAxisYPosition = o.height - o.margin.bottom
    o.xAxisWidth = o.width - o.margin.right - o.margin.left
    o.xTickCount = 12
    o.xTickDistance = o.xAxisWidth / o.xTickCount

    setYTickUnit(o)

    o.yAxisHeight = o.height - o.margin.top - o.margin.bottom
    o.numberOfYTicks = Math.ceil(o.highestPrice / o.yTickUnit) + 1
    o.yTickDistance = o.yAxisHeight / o.numberOfYTicks

    fillBackground(ctx, o)
    renderXAxis(ctx, o)
    renderYAxis(ctx, o)
    renderData(ctx, o, data)
    return await saveImage(canvas, filename)
}

const renderPossibilityData = (ctx, o, prices) => {
    const pointSize = 5

    ctx.textAlign = 'center'

    // Render the data
    ctx.beginPath()

    prices.forEach(({min, max}, i) => {
        const x = o.margin.left + o.innerOffset + (o.xTickDistance * i)
        const pointX = x - (pointSize / 2)

        if (min === max) {
            const y = o.xAxisYPosition - yMap(min, o)
            const pointY = y - (pointSize / 2)

            ctx.fillRect(pointX, pointY, pointSize, pointSize)
            ctx.lineTo(x, y)
            ctx.fillText(min, x, y - 10)
            ctx.stroke()
        } else {
            ctx.strokeStyle = 'grey'
            ctx.fillStyle = 'grey'

            const minY = o.xAxisYPosition - yMap(min, o)
            const maxY = o.xAxisYPosition - yMap(max, o)

            ctx.fillRect(pointX, minY - (pointSize / 2), pointSize, pointSize)
            ctx.fillRect(pointX, maxY - (pointSize / 2), pointSize, pointSize)

            ctx.fillText(min, x, minY + 20)
            ctx.fillText(max, x, maxY - 10)

            ctx.beginPath()
            ctx.lineTo(x, minY)
            ctx.lineTo(x, maxY)
            ctx.stroke()
        }
    })

    ctx.stroke()
}

const createPossibilityChart = async (data, filename) => {
    const o = {
        width: 1000,
        height: 600,
        margin: {
            top: 100,
            right: 50,
            bottom: 100,
            left: 100
        },
        innerOffset: 20
    }

    const canvas = createCanvas(o.width, o.height)
    const ctx = canvas.getContext('2d')

    let high = 0
    data.forEach(({max}) => {
        if (max > high) {
            high = max
        }
    })
    o.highestPrice = high

    o.xAxisYPosition = o.height - o.margin.bottom
    o.xAxisWidth = o.width - o.margin.right - o.margin.left
    o.xTickCount = 12
    o.xTickDistance = o.xAxisWidth / o.xTickCount

    setYTickUnit(o)

    o.yAxisHeight = o.height - o.margin.top - o.margin.bottom
    o.numberOfYTicks = Math.ceil(o.highestPrice / o.yTickUnit) + 1
    o.yTickDistance = o.yAxisHeight / o.numberOfYTicks

    fillBackground(ctx, o)
    renderXAxis(ctx, o)
    renderYAxis(ctx, o)
    renderPossibilityData(ctx, o, data)
    return await saveImage(canvas, filename)
}

const renderProbabilityData = (ctx, o, data) => {
    const pointSize = 5

    ctx.textAlign = 'center'

    ctx.strokeStyle = 'black'
    ctx.fillStyle = 'black'

    const summary = data[data.length - 1]

    summary.prices.slice(2).forEach(({min, max}, i) => {
        const x = o.margin.left + o.innerOffset + (o.xTickDistance * i)
        const pointX = x - (pointSize / 2)

        if (min !== max) {
            const maxY = o.xAxisYPosition - yMap(max, o)
            ctx.fillText(max, pointX, maxY - 10)
        }
    })
    
    data.forEach((entry) => {
        const prices = entry.prices.slice(2)
        prices.forEach(({min, max}, i) => {
            const x = o.margin.left + o.innerOffset + (o.xTickDistance * i)
            const pointX = x - (pointSize / 2)

            if (min === max) {
                const y = o.xAxisYPosition - yMap(min, o)
                const pointY = y - (pointSize / 2)

                ctx.fillRect(pointX, pointY, pointSize, pointSize)
                ctx.fillText(min, x, y - 10)
            } else {
                ctx.strokeStyle = 'grey'
                ctx.fillStyle = `rgba(0, 0, 0, ${entry.probability})`

                const minY = o.xAxisYPosition - yMap(min, o)
                const maxY = o.xAxisYPosition - yMap(max, o)

                ctx.fillRect(pointX - 10, minY - (pointSize / 2), 20, maxY - minY)
            }
        })
    })
}

const createProbabilityChart = async (data, filename) => {
    const o = {
        width: 1000,
        height: 600,
        margin: {
            top: 100,
            right: 50,
            bottom: 100,
            left: 100
        },
        innerOffset: 20
    }

    const canvas = createCanvas(o.width, o.height)
    const ctx = canvas.getContext('2d')

    const summary = data[data.length - 1]
    o.highestPrice = summary.weekMax

    o.xAxisYPosition = o.height - o.margin.bottom
    o.xAxisWidth = o.width - o.margin.right - o.margin.left
    o.xTickCount = 12
    o.xTickDistance = o.xAxisWidth / o.xTickCount

    setYTickUnit(o)

    o.yAxisHeight = o.height - o.margin.top - o.margin.bottom
    o.numberOfYTicks = Math.ceil(o.highestPrice / o.yTickUnit) + 1
    o.yTickDistance = o.yAxisHeight / o.numberOfYTicks

    fillBackground(ctx, o)
    renderXAxis(ctx, o)
    renderYAxis(ctx, o)
    renderProbabilityData(ctx, o, data)

    return await saveImage(canvas, filename)
}

exports.createChart = createChart
exports.createPossibilityChart = createPossibilityChart
exports.createProbabilityChart = createProbabilityChart
