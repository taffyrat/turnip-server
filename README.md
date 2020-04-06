# turnip-server

## Commands

### Buy turnips

Record the number of turnips that you have purchased, and the price you paid for them.

```
@turnip buy <number of turnips> x <price per turnip>
@turnip buy 100 x 99
```

### Add Daisy Mae's price (for YOUR island)

To get the best prediction, you need to tell the bot the price Daisy Mae was selling turnips for on your island, even if you did not buy turnips at this price.

```
@turnip daisy <price per turnip>/t
```

### Add a turnip price

Add a turnip price. By default, it assumes the price is for the current time slot. You can also manually specify a time slot if you are updating a previous price.

```
<price per turnip>/t (morning|afternoon) (monday|tuesday|wednesday|thursday|friday|saturday)
100/t
100/t morning
100/t morning friday
```

### Sell turnips

The bot will check the current prices and determine how much money you could make if you sold now.

```
@turnip sell
```

### Turnip info

The bot will check your current quantity of turnips purchased, along with the price you bought them for and the total price.

```
@turnip info
```

### Graph

The bot will render a graph showing the turnip prices for all users over all time slots.

```
@turnip graph
```

### Predict

The bot will attempt to predict your possible patterns. If there are 5 or fewer possibilities, it will render a graph for each.

```
@turnip predict
```

### Help

The bot will print out a list of commands.

```
@turnip help
```

## Acknowledgements

Original inspiration came from [this great twitter thread](https://twitter.com/nataliewatson/status/1244723856272654344?s=20).

Price predictions from [ac-nh-turnip-prices](https://github.com/mikebryant/ac-nh-turnip-prices).
