export default function handler(req: Request, res: Response) {
  res.status(201).json({ message: "Hello World" });
}
