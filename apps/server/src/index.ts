import { app } from "./app.js";
const port = Number(process.env.PORT ?? 8787);
app.listen(port, "127.0.0.1", () => console.log(`Lia Workcenter API: http://localhost:${port}`));
