var { Apis } = require("bitsharesjs-ws");
var base_url = "wss://bitshares.openledger.info/ws";

var coin_asset_id = null;
var exchange_asset_id = null;

        function precisionRound(number, precision) {
            var factor = Math.pow(10, precision);
            return Math.round(number * factor) / factor;
        }

        function get_orders(coin, exchange, cb) {
            Apis.instance().db_api().exec("get_order_book", ["BRIDGE." + exchange, "BRIDGE." + coin, 50]).then((ob) => {
                var buys = [];
                var sells = [];

                for (bid of ob.bids) {
                    var order = {
                        amount: precisionRound(parseFloat(bid.quote), 8),
                        price: precisionRound(parseFloat(bid.price), 8).toFixed(8),
                        total: (precisionRound(parseFloat(bid.quote), 8).toFixed(8) * precisionRound(parseFloat(bid.price), 8)).toFixed(8)
                    };
                    buys.push(order);
                }

                for (ask of ob.asks) {
                    var order = {
                        amount: precisionRound(parseFloat(ask.quote), 8),
                        price: precisionRound(parseFloat(ask.price), 8).toFixed(8),
                        total: (precisionRound(parseFloat(ask.quote), 8).toFixed(8) * precisionRound(parseFloat(ask.price), 8)).toFixed(8)
                    };
                    sells.push(order);
                }

                return cb(null, buys, sells);
            }).catch(err => {
                return cb(err, null, null);
            });
        }

        function get_trades(coin_id, exchange_id, cb) {
            Apis.instance().history_api().exec("get_fill_order_history", [exchange_id, coin_id, 50]).then((th) => {
                var trades = [];

                for (currTrade of th) {
                    if (!currTrade.op.is_maker)
                    {
                        var orderType = "BUY";
                        var amount = 0;
                        var total = 0;
                        var price = 0;
                        if (currTrade.op.pays.asset_id == coin_id)
                        {
                            orderType = "SELL";
                            amount = (currTrade.op.pays.amount / 10000).toFixed(8);
                            total = (currTrade.op.receives.amount / 100000000).toFixed(8);
                        }
                        else
                        {
                            amount = (currTrade.op.receives.amount / 10000).toFixed(8);
                            total = (currTrade.op.pays.amount / 100000000).toFixed(8);
                        }
                        price = (total / amount).toFixed(8);

                        var trade = {
                            TimeStamp: currTrade.time,
                            Quantity: amount,
                            Price: price,
                            Total: total,
                            OrderType: orderType
                        };
                        trades.push(trade);
                    }
                }

                return cb(null, trades);
            }).catch(err => {
                return cb(err, null);
            });
        }

        function get_summary(coin, exchange, coin_id, exchange_id, cb)
        {
            Apis.instance().db_api().exec("get_ticker", ["BRIDGE." + exchange, "BRIDGE." + coin]).then((ticker) => {
                var summary = {
                    High: 0, // has to be requested somehow
                    Low: 0,
                    Volume: precisionRound(ticker.base_volume, 3).toFixed(3),
                    Bid: precisionRound(ticker.highest_bid, 8).toFixed(8),
                    Ask: precisionRound(ticker.lowest_ask, 8).toFixed(8),
                    Last: precisionRound(ticker.latest, 8).toFixed(8),
                    PrevDay: 0,
		    Change: precisionRound(ticker.percent_change, 2).toFixed(2),
                };

                return cb(null, summary);
                /*var today = new Date(Date.now());
                var yesterday = new Date(Date.now() - (60*60*60*24));

                Api.instance().history_api().exec("get_market_history", [exchange_id, coin_id, 86400, yesterday.toISOString().split('.')[0], today.toISOString().split('.')[0]]).then((market_24) => {
                    console.log(market_24);

                    var summary = {
                        High: 0,
                        Low: 0,
                        Volume: precisionRound(ticker.base_volume, 3).toFixed(3),
                        Bid: precisionRound(ticker.highest_bid, 8).toFixed(8),
                        Ask: precisionRound(ticker.lowest_ask, 8).toFixed(8),
                        Last: precisionRound(ticker.latest, 8).toFixed(8),
                        Change: precisionRound(ticker.percent_change, 2).toFixed(2),
                    };

                    return cb(null, summary);
                }).catch(err => {
                    return cb(err, null);
                });*/
            }).catch(err => {
                return cb(err, null);
            });
        }

        function get_bts_asset_ids(coin, exchange, cb)
        {
            Apis.instance().db_api().exec("lookup_asset_symbols", [["BRIDGE." + coin, "BRIDGE." + exchange]]).then((asset_sym) => {
                if (asset_sym.length == 2)
                {
                    return cb(null, asset_sym[0].id, asset_sym[1].id);
                }
            }).catch(err => {
                return cb(err, null, null);
            });
	}

module.exports = {
	get_data: function(coin, exchange, cb)
	{
            var error = null;
            Apis.instance(base_url, true).init_promise.then((res) => {
                get_bts_asset_ids(coin, exchange, function(err, coin_id, exchange_id) {
                    if (err) { error = err; }
                    coin_asset_id = coin_id;
                    exchange_asset_id = exchange_id;

                    get_orders(coin, exchange, function(err, buys, sells) {
                        if (err) { error = err; }
                        get_trades(coin_asset_id, exchange_asset_id, function(err, trades) {
                            if (err) { error = err; }
                            get_summary(coin, exchange, coin_asset_id, exchange_asset_id, function(err, stats) {
                                if (err) { error = err; }
                                return cb(error, {buys: buys, sells: sells, chartdata: [], trades: trades, stats: stats});
                            });
                        });
                    });
                });
            }).catch(err => {
                return cb(err, null);
            });
	}
};
