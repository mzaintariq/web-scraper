const axios = require('axios');
const { JSDOM } = require("jsdom");
const fs = require('fs');
const URL = "https://www.adidas.com";

(async function () {
    try {
        const response = await axios.get(URL);
        const dom = new JSDOM(response.data);

        let categories = dom.window.document.querySelectorAll('.headline > a');
        for (const category of categories) {
            if (category.href.match(/shoes|apparel|accessories/)) {
                await scrapeProducts(URL + category.href);
            }
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
                fs.appendFile(`./${category}.txt`, JSON.stringify(productData, null, 2) + ',\n', 'utf-8', err => {
                    if (err) {
                        console.error(err);
                    }
                });
            }
            itemNumber += viewSize;
        } while (itemNumber < count);
        
	} catch (err) {
		console.error(err);
	}
}

async function getData(url) {
	try {
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);

        const productData = {};
        
        productData["name"] = getText(dom, '.gl-heading');
        productData["description"] = getDescription(response);
        productData["sellingPrice"] = getText(dom, '.gl-price-item');
        productData["originalPrice"] = getOriginalPrice(dom);
        productData["color"] = getText(dom, '.color-and-price___2q0A2 > h5');
        productData["imageURLs"] = await getImageURLs(url);

        const colorArr = getColorOptions(dom);
        productData["colorsAvailable"] = colorArr.length;
        productData["colorOptions"] = colorArr;
        
        const sizes = await getSizes(url);
        if (sizes !== "Not Available.") {
            productData["sizesAvailable"] = sizes.length;
            productData["sizesOptions"] = sizes;
        } else {
            productData["sizesAvailable"] = 0;
        }

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

        if (sizeList) {
            let sizeArr = [];
            for (const size of sizeList) {
                if (size.availability_status === 'IN_STOCK') {
                    sizeArr.push(size.size);
                }
            }
            return sizeArr;
        } else {
            return "Not Available.";
        }

	} catch (err) {
		console.error(err)
	}
}

async function getImageURLs(url) {
    try {
        let productCode = url.match(/[^\/]+$/)[0];
        productCode = productCode.match(/(.*?).html/)[0];
        productCode = productCode.substring(0, productCode.length - 5);
        const sizeURL = `https://www.adidas.com/api/products/${productCode}?sitePath=us`;

        const { data } = await axios.get(sizeURL);
        const imgList = data.view_list;

        let imgArr = [];
        for (const img of imgList) {
            imgArr.push(img.image_url);
        }
        return imgArr;

	} catch (err) {
		console.error(err)
	}
}

function getDescription(response) {
	let re = /"subtitle(.*?)"text/;
    if (response.data.match(re)) {
        let description = response.data.match(re)[0];
        description = description.slice(14);
        description = description.substring(0, description.length - 9);
        return description;
    } else {
        return "No Description.";
    }
}

function getText(dom, path) {
	return dom.window.document.querySelector(path).textContent;
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
        return [dom.window.document.querySelector(".color-and-price___2q0A2 > h5").textContent];
    }
}