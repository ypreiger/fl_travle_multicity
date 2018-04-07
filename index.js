const puppeteer = require('puppeteer');
const _ = require("lodash");
const comp = require('js-combinatorics');
const fs = require('fs');


const airports = [
    "SCL",
    "AEP,EZE",
    "MDZ"
];

const days = _.range(7, 22, 1);

const makeStr = ({from, to, at}) => {
    return `${from}_${to}_2018-07-${at < 10 ? '0' : ''}${at}`
}


const all_airport_options = comp.permutation(airports).map((arr) => ['POA', ...arr, 'POA']);

const  isAscending = a => a.slice(1)
                        .map((e,i) => e > a[i])
                        .every(x => x);
const isAtLeast3DaysApart = a => a.slice(1)
                        .map((e, i) => (e - a[i]) >= 3)
                        .every(x => x);

const hasAtLeast14DaysOfTravel = a => a[a.length - 1] - a[0] > 13

const days_permut = comp.permutation(days, 4).filter((arr) => isAscending(arr));
const possible_days = days_permut.filter((arr) => isAtLeast3DaysApart(arr) && hasAtLeast14DaysOfTravel(arr));

const search_arr = [];

for (let day_arr of possible_days) {
    for (let airport_combination of all_airport_options) {
        const search_line = [];
        airport_combination.slice(1).forEach((_, i) => {
            const search = {
                from: airport_combination[i],
                to: airport_combination[i+1],
                at: day_arr[i]
            }
            search_line.push(search)
        })
        search_arr.push(search_line)
    }
}

const saved_prices = fs.readFileSync('precos.csv', 'utf8')
const strings = saved_prices.split("\n").map((line) => line.split(";")[0]);

const search_strings = search_arr.map((arr) => arr.map(makeStr).join('*')).filter((search_str) => !strings.includes(search_str));

var running_promises = 0;
const canIGo = async () => {
    return new Promise((resolve, reject) => {
        if (running_promises >= 5) {
            setTimeout(function() {
                resolve(canIGo())
            }, 100);
        } else {
            running_promises++;
            resolve();
        }
    });
}

const alreadyWent = () => Promise.resolve(--running_promises);

(async () => {

    const browser = await puppeteer.launch({headless: false})

    const getBestPriceFor = async (searchStr) => {
        await canIGo();
      const page = await browser.newPage();
      // POA_SCL_2018-07-09*SCL_AEP,EZE_2018-07-19*AEP,EZE_MDZ_2018-07-26*MDZ_POA_2018-08-02
      await page.goto(`https://www.google.com/flights/?f=0&curr=BRL#search;iti=${searchStr};tt=m`, {waitUntil: 'networkidle0'});
      const [bestPrice] = await page.$$eval('.LJV2HGB-d-Ab', (prices) => prices.map(price => price.textContent))
    page.close()
      await alreadyWent();
      return bestPrice;
    }

    const logAndGetPrice = async (searchStr, index) => {
        let csv = search_arr[index].reduce((acc, val) => acc + `${val.from};${val.to};${val.at}/07/18;`, `${searchStr};`);
        const price = await getBestPriceFor(searchStr);
        csv += `;${price}`;
        fs.appendFileSync('precos.csv', csv + "\n", 'utf8')
    }

    await Promise.all(search_strings.map(logAndGetPrice))

    browser.close();

});
