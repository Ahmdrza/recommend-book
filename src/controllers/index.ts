import { Request, Response } from "express";
import Puppeteer from "puppeteer";

import { Category } from "category";
import { categories } from "../utils/categories";

export const index = async (req: Request, res: Response): Promise<void> => {
    res.render("index", { categories });
};

export const scrapGenre = async (
    req: Request,
    res: Response,
): Promise<Record<string, any>> => {
    const browser = await Puppeteer.launch();

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.goto("https://www.goodreads.com/choiceawards/best-books-2020");
    await page.waitForSelector(".category__copy");

    const categories = await page.$$eval(".category", categories => {
        const genres: Category[] = [];
        categories.forEach(category => {
            genres.push({
                category: category
                    .querySelector(".category__copy")
                    .textContent.replaceAll("\n", ""),
                url: category.querySelector("a").href,
            });
        });
        return genres;
    });
    return res.status(200).json({ categories });
};

export const getRandomBookFromGenre = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const genre = req.query.genre.toString();
    const browser = await Puppeteer.launch();

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.goto(genre);
    await page.waitForSelector(".pollAnswer");

    const book = await page.$$eval(".pollAnswer", books => {
        const max = books.length - 1;
        const min = 0;
        return books[
            Math.floor(Math.random() * (max - min + 1) + min)
        ].querySelector("img").alt;
    });
    res.render("book-selected", { book });
};

export const checkout = async (
    req: Request,
    res: Response,
): Promise<Record<string, any>> => {
    const bookTitle = req.query.book.toString();
    const browser = await Puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.goto("https://amazon.com");
    await page.select(
        "select#searchDropdownBox",
        "search-alias=stripbooks-intl-ship",
    );
    await page.type("input#twotabsearchtextbox", bookTitle);
    await page.click("input#nav-search-submit-button");
    await page.waitForSelector(".s-result-item");

    const noBooksFound = await page.$$eval(
        ".s-result-item .a-section span",
        nodes => nodes.some(node => node.textContent === "No results for "),
    );

    if (noBooksFound) {
        await browser.close();
        return res.status(404).json({
            status: "error",
            message: "Book not found",
        });
    }

    await page.click(
        ".s-result-item .a-section .s-product-image-container .a-link-normal",
    );
    await page.waitForSelector(".swatchElement");

    // find paperback or hardcopy url
    const hardCopyUrl = await page.$$eval(".swatchElement", options => {
        const hardCopies = options.filter(node =>
            ["Paperback", "Hardcover"].includes(
                node.querySelector(".a-button-text span").textContent,
            ),
        );
        if (hardCopies && hardCopies.length > 0) {
            return (
                hardCopies[0].querySelector(
                    "a.a-button-text",
                ) as HTMLAnchorElement
            ).href;
        }
        return undefined;
    });

    if (!hardCopyUrl) {
        return res.status(404).json({
            status: "error",
            message: "Book not found",
        });
    }

    await page.goto(hardCopyUrl);
    await page.waitForSelector("input#add-to-cart-button");

    const addToCardButtonFound = await page.$eval(
        "input#add-to-cart-button",
        node => !!node,
    );
    if (!addToCardButtonFound) {
        return res.status(404).json({
            status: "error",
            message: "Add to card button not found",
        });
    }

    await page.click("input#add-to-cart-button");
    await page.waitForSelector("a#nav-cart");
    await page.click("a#nav-cart");
    return res.status(200).json({ status: "success" });
};
