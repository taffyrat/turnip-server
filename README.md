# turnip-server

## Commands

### Buy turnips

Record the number of turnips that you have purchased, and the price you paid for them.

```
@turnip buy <number of turnips> x <price per turnip>
@turnip buy 100 x 99
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

### Help

The bot will print out a list of commands.

```
@turnip help
```
