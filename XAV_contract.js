"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.handle = void 0;
var ERR_NOQTY = "No qty specified";
var ERR_NOTARGET = "No target specified";
var ERR_INTEGER = "Invalid value. Must be an integer";
function transfer_XAV(state, caller, target, qty) {
    var balances = state.balances;
    balances[caller] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
}
function transfer_GMX_XAV(state, caller, target, qty) {
    var balances = state.balances;
    balances[caller] -= qty;
    balances["locked"] += qty;
}
function transfer_XAV_GMX(state, caller, target, qty) {
    var balances = state.balances;
    var waiting_txs = state.waiting_txs;
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
    waiting_txs[Object.keys(waiting_txs).length] = { "owner": caller, "target": target, "target_ticker": "GMX", "ticker": "XAV", "qty": qty };
}
function balance(state, target) {
    var _a;
    // get locked token balance with "locked" as target
    ContractAssert(target, ERR_NOTARGET);
    return (_a = state.balances[target]) !== null && _a !== void 0 ? _a : 0;
}
function check_transfer_args(caller, target, qty) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, "Invalid value for qty. Must be positive");
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}
function handle(state, action) {
    return __awaiter(this, void 0, void 0, function () {
        var input, caller, target, ticker, ticker_target, qty, target, ticker;
        return __generator(this, function (_a) {
            input = action.input;
            caller = action.caller;
            if (input["function"] == 'transfer') {
                target = input.target;
                ticker = input.ticker;
                ticker_target = input.ticker_target;
                qty = input.qty;
                ContractAssert(qty, ERR_INTEGER);
                check_transfer_args(caller, target, qty);
                if (ticker === "XAV" && ticker_target === "GMX") {
                    transfer_XAV_GMX(state, caller, target, qty);
                }
                else if (ticker === "XAV" && ticker_target === "XAV") {
                    transfer_XAV(state, caller, target, qty);
                }
                else if (ticker === "GMX" && ticker_target === "XAV") {
                    transfer_GMX_XAV(state, caller, target, qty);
                }
                else {
                    throw new ContractError("No transfer allowed between: 'XAV' and '" + ticker_target + "\".");
                }
                return [2 /*return*/, { state: state }];
            }
            if (input["function"] == 'balance') {
                target = input.target;
                ticker = input.ticker;
                if (ticker !== "XAV") {
                    throw new ContractError("The balance ticker is not allowed.");
                }
                return [2 /*return*/, { result: { target: ticker, balance: balance(state, target) } }];
            }
            throw new ContractError("No function supplied or function not recognised: \"" + input["function"] + "\".");
        });
    });
}
exports.handle = handle;
