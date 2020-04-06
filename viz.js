const fs = require('fs')
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

const yMap = (input, o) => {
    const slope = (o.numberOfYTicks * o.yTickDistance) / o.highestPrice
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
    // Y axis should scale based on the highest value in the data set provided
    // It should go 10 above the current highest price
    // Lines for every 10 bells?
    for (let i = 0; i < o.numberOfYTicks; i++) {
        const y = o.xAxisYPosition - (o.yTickDistance * i) - o.innerOffset

        ctx.beginPath()
        ctx.lineTo(o.margin.left - 10, y)
        ctx.lineTo(o.margin.left + 10, y)
        ctx.stroke()

        ctx.fillText(i * 10, o.margin.left - o.innerOffset, y)
    }
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
            if (price === 0) {
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

const saveImage = async (canvas, filename) => {
    return new Promise((resolve) => {
        const out = fs.createWriteStream(filename)
        const stream = canvas.createPNGStream()
        stream.pipe(out)
        out.on('finish', () =>  {
            console.log('Created a new chart PNG')
            resolve()
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

    o.yAxisHeight = o.height - o.margin.top - o.margin.bottom
    o.numberOfYTicks = Math.ceil(o.highestPrice / 10) + 1
    o.yTickDistance = Math.floor(o.yAxisHeight / o.numberOfYTicks)

    fillBackground(ctx, o)
    renderXAxis(ctx, o)
    renderYAxis(ctx, o)
    renderData(ctx, o, data)
    await saveImage(canvas, filename)
}

exports.createChart = createChart
