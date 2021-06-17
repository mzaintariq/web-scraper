const axios = require('axios');
const { JSDOM } = require("jsdom");
const fs = require('fs');

(async () => {
    try {
        let urls = ["https://www.adidas.com/us/men-shoes",
                    "https://www.adidas.com/us/men-apparel",
                    "https://www.adidas.com/us/men-accessories", 
                    "https://www.adidas.com/us/women-shoes",
                    "https://www.adidas.com/us/women-apparel",
                    "https://www.adidas.com/us/women-accessories",
                    "https://www.adidas.com/us/boys-shoes",
                    "https://www.adidas.com/us/boys-apparel",
                    "https://www.adidas.com/us/girls-shoes",
                    "https://www.adidas.com/us/girls-apparel",
                    "https://www.adidas.com/us/kids-infant_toddler"];

        for (const url of urls) {
            await scrapeProducts(url);
        }

	} catch (err) {
		console.error(err);
	}
})();

async function scrapeProducts(url) {
	try {
        const category = url.match(/[^\/]+$/)[0];
        let newURL = `https://www.adidas.com/api/plp/content-engine?sitePath=us&query=${category}`;
        let { data } = await axios.get(newURL);
        const count = data.raw.itemList.count;
        const viewSize = data.raw.itemList.viewSize;

        fs.writeFile(`./${category}.txt`, 'Category: ' + category.toUpperCase() + '\n' + 'Total Products: ' + count + '\n\n', err => {
            if (err) {
                console.error(err)
                return
            }
        })

        let itemNumber = 0;
        do {
            newURL = `https://www.adidas.com/api/plp/content-engine?sitePath=us&query=${category}&start=${itemNumber}`;
            let { data } = await axios.get(newURL);
            let itemList = data.raw.itemList.items;
            for (const item of itemList) {
                let productData = await getData("https://www.adidas.com" + item.link);
                fs.appendFile(`./${category}.txt`, JSON.stringify(productData, null, 2) + ',\n\n', 'utf-8', err => {
                    if (err) {
                        console.error(err);
                    }
                });
            }
            itemNumber += viewSize;
        } while (itemNumber < count);
        
	} catch (error) {
		console.error(error);
	}
}


async function getData(url) {
	try {
        const resp = await axios.get(url);
        const dom = new JSDOM(resp.data);

        let productData = {};
        
        productData["name"] = dom.window.document.querySelector('.gl-heading').textContent;
        productData["description"] = getDescription(resp);
        productData["sellingPrice"] = dom.window.document.querySelector('.gl-price-item').textContent;
        productData["originalPrice"] = getOriginalPrice(dom);
        productData["color"] = dom.window.document.querySelector(".color-and-price___2q0A2 > h5").textContent;
        productData["imageURL"] = dom.window.document.querySelector('.content___1wmQY').getElementsByTagName('img')[0].src;

        const colorArr = getColorOptions(dom);
        productData["colorsAvailable"] = colorArr.length;
        productData["colorOptions"] = colorArr;

        const sizes = await getSizes(url);
        productData["sizesAvailable"] = sizes.length;
        productData["sizesOptions"] = sizes;

        return productData;
        
	} catch (err) {
		console.error(err);
	}
}

async function getSizes(url) {
	try {
        let productCode = url.match(/[^\/]+$/)[0];
        productCode = productCode.match(/(.*?).html/)[0];
        productCode = productCode.substring(0, productCode.length - 5);
        const sizeURL = `https://www.adidas.com/api/products/${productCode}/availability?sitePath=us`;

        const { data } = await axios.get(sizeURL);
        const sizeList = data.variation_list;

        let sizeArr = [];
        for (const size of sizeList) {
            if (size.availability_status === 'IN_STOCK') {
                sizeArr.push(size.size);
            }
        }
        return sizeArr;

	} catch (error) {
		console.error(error)
	}
}

function getDescription(resp) {
	let re = /"subtitle(.*?)"text/;
    if (resp.data.match(re)) {
        let description = resp.data.match(re)[0];
        description = description.slice(14);
        description = description.substring(0, description.length - 9);
        return description;
    } else {
        return "No Description.";
    }
}

function getOriginalPrice(dom) {
	if (dom.window.document.querySelector('.gl-price-item--crossed')) {
        return dom.window.document.querySelector('.gl-price-item--crossed').textContent;
    } else {
        return dom.window.document.querySelector('.gl-price-item').textContent;
    }
}

function getColorOptions(dom) {
	if (dom.window.document.querySelector('.slider___3j24m')){
        const colorList = dom.window.document.querySelector('.slider___3j24m').getElementsByTagName('a');
        let colorArr = [];
        for (const color of colorList) {
            colorArr.push(color.title);
        }
        return colorArr;
    } else {
        return dom.window.document.querySelector(".color-and-price___2q0A2 > h5").textContent;
    }
}