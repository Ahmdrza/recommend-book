import { Router } from "express";
import {
    index,
    scrapGenre,
    getRandomBookFromGenre,
    checkout,
} from "../controllers/index";

export const router = Router();

router.get("/", index);
router.get("/genre", scrapGenre);
router.get("/genre/random-book", getRandomBookFromGenre);
router.get("/checkout", checkout);
