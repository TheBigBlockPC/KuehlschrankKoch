import { useState, useRef } from 'react'
import spinner from './assets/spinner.svg'
import regenerate from './assets/reload.svg'
import './App.css'

function make_API_call(endpoint,data){
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }).then(res => {
    if(!res.ok){
        throw new Error(`HTTP ${res.status}`)
    }
    return res.json();
  })
}
function Preference_element( props ){
  return (
    <label className="container">
      {props.label}
      <input type="checkbox" ref={props.ref}/>
      <span className="checkmark"></span>
    </label>
  )
}
function OptionalUnorderedList(props){
  let items=props.list
  if(items.length == 0){
    return <></>
  }else{
    return <>
      {props.title}
      <ul>
        {items.map(item =>{return <li>{item}</li>})}
      </ul>
    </>
  }
}
function RecipesOutput(props){
  const recipes = props.state
  
  let key = 0;
  if(recipes.status == "none"){
    return <></>
  }
  if(recipes.status == "loading"){
    return <div className='outputContainer'>
      Anfrage wind gesendet
      <img src={spinner} className="spinner" />
    </div>
  }
  if(recipes.status == "processing"){
    return <div className='outputContainer'>
      {recipes.message}
      <img src={spinner} className="spinner" />
    </div>
  }
  if(recipes.status == "error"){
    return <div className='outputContainer Error'>
      Ein Fehler ist aufgetreten<br />
      {recipes.error}
    </div>
  }
  if(recipes.status == "rejected"){
    return <div className='outputContainer Error'>
      Anfrage abgelehnt:<br />
      {recipes.error}
    </div>
  }
  if(recipes.status == "done"){
    const r = recipes.recipes[0]
    const ingredients = r.ingredients
    const missing_ingredients = r.missing_ingredients
    const steps = r.steps
    return (
      <div className='outputContainer'>
        <h1 className='centered'>{r.title}</h1>
        <h2 className='centered'>{r.description}</h2>
        <br />
        <OptionalUnorderedList title="Zutaten:" list={ingredients}/>
        <br />
        <OptionalUnorderedList title="Fehlende Zutaten:" list={missing_ingredients}/>
        <br />
        Zubereitung:
        <ol>
          {steps.map(item =>{key += 1; return <li key={key}>{item}</li>})}
        </ol>
        <br />
        Schwierigkeit: {r.difficulty}
        <button onClick={props.generate_function}>
          <img src={regenerate} alt='generate again'></img>
        </button>
      </div>
    )
  }
  return <div className='outputContainer Error'>
    Ungültiger status: {recipes.status}
  </div>
}

function App(){
  const vegan = useRef(null);
  const vegetarian = useRef(null);
  const glutenfree = useRef(null);
  const ingredients = useRef(null);
  const [recipes, setrecipes] = useState({
    status: "none"
  })
  const generate_event = () => {
    let data = {
      vegan: vegan.current?.checked,
      vegetarian: vegetarian.current?.checked,
      glutenfree: glutenfree.current?.checked,
      ingredients: ingredients.current?.value
    }
    console.log(data);
    setrecipes(
      {
        status:"loading"
      }
    )
    make_API_call("/api/generate",data).then( res => {
      const ID = res.recipe_context;
      let interval = setInterval(()=>{
        make_API_call("/api/poll",{recipe_context:ID}).then( res2 => {
          if(res2.status == "done" || res2.status == "error" || res2.status == "reject"){
            clearInterval(interval)
          }
          setrecipes(
            res2
          )
        }).catch( err => {
          setrecipes(
            {
              status:"error",
              error: err.toString()
            }
          )
        })
      },1000)
      
    }).catch( err => {
      setrecipes(
        {
          status:"error",
          error: err.toString()
        }
      )
    })
    //.then(res => setCount((count) => res.count))
    
  }
  return (
    <>
      <img src='/Logo.png' className='logo' />
      <div className='inputContainer'>
        <label>Verfügbare zutaten</label>
        <textarea className='ingredients' ref={ingredients}></textarea>
        <label>Zusßtzliche optionen:</label>
        <div>
          <Preference_element label="vegan" ref={vegan} />
          <Preference_element label="vegetarisch" ref={vegetarian} />
          <Preference_element label="glutenfrei" ref={glutenfree} />
        </div>
        <button onClick={
          generate_event
        }>Rezepte finden</button>
      </div>

      <RecipesOutput state={recipes} generate_function={generate_event}/>
    </>
  )
}
export default App
