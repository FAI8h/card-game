import dotenv from 'dotenv';
dotenv.config();

import { startServer } from "./src/server/wsRouter.js";

startServer(process.env.PORT || 5000);