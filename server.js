const crypto = require("crypto");
const path = require('path');
const express = require('express');
const openai = require("openai")
const fs = require('fs');
const PDF = require('pdfkit');

//const PDFDocument = PDF.PDFDocument;

const app = express();
const apiKey = fs.readFileSync('apikey.key', 'utf8');
const client = new openai.OpenAI(
    {
        apiKey :apiKey
    }
);
function generate_prompt(data){
    const validKeywords = new Set(["schnell","Mikrowelle","Backofen","Pfanne","Heißluftfritöse","kein kochen"])
    let ingredients = data.ingredients
    let prompt = "vorhandene zutaten:\n\"\"\"\n"
    ingredients = ingredients.replace("\"\"\"","")
    prompt = prompt + ingredients + "\n\"\"\"\nPräferenzen: "
    if(data.vegan){
        prompt = prompt + "Vegan, "
    }
    if(data.vegetarian){
        prompt = prompt + "Vegetarisch, "
    }
    if(data.glutenfree){
        prompt = prompt + "Glutenfrei, "
    }
    prompt = prompt +"\nZubereitungsprüferenzen: "
    for(let i =0;i < data.extra_preferences.length;i++){
        let extra_preference = data.extra_preferences[i]
        if(validKeywords.has(extra_preference)){
            prompt = prompt + extra_preference + ", "
        }
    }
    return prompt
}
async function generate_object(system_prompt,prompt,scema,reasoning="none"){
    const response = await client.responses.create({
        model: "gpt-5.1",
        input: [
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": system_prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            }
        ],
        text: {
            "format": {
                "type": "json_schema",
                "name": "flagged_message",
                "strict": true,
                "schema": scema
            }
        },
        reasoning: {
            "effort": reasoning,
            "summary": "auto"
        }
    })
    return JSON.parse(response.output_text)
}
async function generate_recipe(data,id) {
    const moderation_prompt = fs.readFileSync('./config/moderation_prompt.txt', 'utf8');
    const moderation_scema = JSON.parse(fs.readFileSync('./config/moderation_scema.json', 'utf8'));
    const recipe_prompt = fs.readFileSync('./config/recipe_prompt.txt', 'utf8');
    const recipe_scema = JSON.parse(fs.readFileSync('./config/recipe_scema.json', 'utf8'));
    //console.log(data.extra_preferences)
    let prompt = generate_prompt(data)
    if (data.ingredients == "%debug%"){
        responses[id] = {
            status:"done",
            recipes: [
                {
                    ingredients:["apfel", "birne"],
                    missing_ingredients:["apfel", "birne"],
                    steps:["a long debug test to test wrapping of text to see if styling works. a long debug test to test wrapping of text to see if styling works. a long debug test to test wrapping of text to see if styling works."],
                    difficulty:"test",
                    title:"Debug",
                    description:"a long debug test to test wrapping of text to see if styling works"
                }
            ],
            id: id
        }
        return
    }
    if (data.ingredients == "%debug2%"){
        responses[id] = {
            status:"done",
            recipes: [
                {
                    ingredients:[],
                    missing_ingredients:[],
                    steps:[prompt],
                    difficulty:"test",
                    title:"Debug",
                    description:""
                }
            ],
            id: id
        }
        return
    }
    responses[id] = {
        status:"processing",
        message:"Anfrage wird überprüft"
    }
    const moderation_output = await generate_object(moderation_prompt,prompt,moderation_scema)
    if(moderation_output.flagged){
        responses[id] = {
            status:"rejected",
            error:moderation_output.message
        }
        return
    }
    responses[id] = {
        status:"processing",
        message:"Rezept wird generiert"
    }
    let recipe = await generate_object(recipe_prompt,prompt,recipe_scema)
    recipe.status = "done"
    recipe.id = id
    responses[id] = recipe
}

var responses = {}

var count = 0
app.use(express.json());
// Serve API routes first
app.get('/api/hello', (req, res) => {
    res.json({ message: 'hello world' });
});
app.get('/api/count', (req, res) => {
    count += 1
    res.json({ count: count });
});
app.post('/api/generate', (req, res) => {
    const id = crypto.randomUUID().toString();
    responses[id] = {
        status:"loading",
        recipes: []
    }
    generate_recipe(req.body,id);
    res.json({recipe_context:id});
});
app.post('/api/poll', (req, res) => {
    const id = req.body.recipe_context;
    if (id == undefined){
        res.status(400).json({status:"error",error:"invallid request"});
    }
    const response = responses[id]

    //if(response?.status == "done"){
    //    responses[id] = undefined
    //}
    if(!response){
        res.status(404).json({status:"error",error:"element not found"});
    }else{
        res.json(response);
    }
});

function add_horizontal_line(doc){
    doc.moveTo(50, doc.y + 10)       // x start, y start
        .lineTo(550, doc.y + 10)      // x end, y same
        .lineWidth(1)                 // line thickness
        .strokeColor('#000000')       // line color
        .stroke();                     // actually draw the line
    doc.moveDown();
}
function add_logo(doc){
    const imagePath = './frontend/public/Logo.png';
    const imageWidth = 100; // desired width
    const imageHeight = 100; // optional, PDFKit preserves aspect ratio if not provided

    // Calculate top-right corner
    const pageWidth = doc.page.width;
    const margin = 50; // same as doc margin
    const x = pageWidth - imageWidth - margin; // right-aligned
    const y = margin; // from top

    // Place the image
    doc.rect(x, y, imageWidth, imageHeight).fillColor('#ffffff').fill();
    doc.image(imagePath, x, y, { width: imageWidth, height: imageHeight });
    
}
app.get('/pdf/:id', (req, res) => {
    const { id } = req.params;
    const response = responses[id]
    if(!response){
        res.status(404).json({status:"error",error:"element not found"});
    }
    if(response.status != "done"){
        res.status(404).json({status:"error",error:"element not found"});
    }
    const content = response.recipes[0]
    /*{
        ingredients:["apfel", "birne"],
        missing_ingredients:["apfel", "birne"],
        steps:["a long debug test to test wrapping of text to see if styling works. a long debug test to test wrapping of text to see if styling works. a long debug test to test wrapping of text to see if styling works."],
        difficulty:"test",
        title:"Debug",
        description:"a long debug test to test wrapping of text to see if styling works"
    }*/
    // Create a new PDF document in memory
    const doc = new PDF({ size: 'A4', margin: 50 });
    const width = doc.page.width-100;
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${content.title}.pdf"`);

    // Pipe PDF to response directly (in-memory)
    doc.pipe(res);
    
    // Add some content
    doc.fontSize(25).text(content.title, { align: 'center',width: width-100});
    doc.fontSize(18).text(content.description, { align: 'center',width: width-100});
    add_horizontal_line(doc);
    doc.fontSize(18).text('Zutaten:', { align: 'left' });
    content.ingredients.forEach(item => {
        doc.text(`• ${item}`, { indent: 20 });
    });
    add_horizontal_line(doc);
    doc.fontSize(18).text('Schritte:', { align: 'left' });
    content.steps.forEach((item, i) => {
        doc.text(`${i + 1}. ${item}`, { indent: 20 });
    });
    add_horizontal_line(doc);
    doc.fontSize(18).text(`Schwierigkeit: ${content.difficulty}`, { align: 'left' });
    doc.moveDown();
    doc.fontSize(11).text("Dieses rezept wurde von KI generiert", { align: 'left' });
    add_logo(doc)
    // Finalize the PDF and end the stream
    doc.end();
});
// Serve static files from the Vite build
const distPath = path.join(__dirname, 'frontend/dist'); // adjust if different path
app.use(express.static(distPath));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));