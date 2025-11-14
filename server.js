const crypto = require("crypto");
const path = require('path');
const express = require('express');
const openai = require("openai")
const fs = require('fs');

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
            ]
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
            ]
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

    if(response?.status == "done"){
        responses[id] = undefined
    }
    if(!response){
        res.status(404).json({status:"error",error:"element not found"});
    }else{
        res.json(response);
    }
});
// Serve static files from the Vite build
const distPath = path.join(__dirname, 'frontend/dist'); // adjust if different path
app.use(express.static(distPath));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));