import { useState, useRef } from 'react'
import spinner from './assets/spinner.svg'
import regenerate from './assets/reload.svg'
import download from './assets/download.svg'
import arrow_left from './assets/arrow_left.svg'
import arrow_right from './assets/arrow_right.svg'
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
  const recipe_idx = props.recipe_idx[0]
  const recipe_idx_set = props.recipe_idx[1]
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
    const r = recipes.recipes[recipe_idx]
    const ingredients = r.ingredients
    const missing_ingredients = r.missing_ingredients
    const steps = r.steps
    const URL = `/pdf/${recipes.id}/${recipe_idx}`
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
        <div className="recipe_interactions">
          <button onClick={props.generate_function}>
            <img src={regenerate} alt='generate again'></img>
          </button>
          <a href={URL} className='download_btn' download><img src={download}></img></a>
          <button onClick={()=>{
            recipe_idx_set(recipe_idx-1)
          }} disabled={recipe_idx <= 0}>
            <img src={arrow_left} alt='prev'></img>
          </button>
          {recipe_idx+1} / {recipes.recipes.length}
          <button onClick={()=>{
            recipe_idx_set(recipe_idx+1)
          }} disabled={recipe_idx >= recipes.recipes.length-1}>
            <img src={arrow_right} alt='next'></img>
          </button>
        </div>
      </div>
    )
  }
  return <div className='outputContainer Error'>
    Ungültiger status: {recipes.status}
  </div>
}
function ToggleTag(props){
  return (
    <label className="toggle-tag">
      <input type="checkbox" onChange={(e)=>{
        let elementSet = props.target[0]
        if(e.target.checked){
          elementSet.add(props.text)
        }else{elementSet
          elementSet.delete(props.text)
        }
        props.target[1](elementSet)
      }}/>
      <span className="tag">{props.text}</span>
    </label>
  )
}
function App(){
  const vegan = useRef(null);
  const vegetarian = useRef(null);
  const glutenfree = useRef(null);
  const ingredients = useRef(null);
  const send_btn = useRef(null);
  const [recipes, setrecipes] = useState({
    status: "none"
  })
  const [send_disabled,set_send_disabled] = useState(true)
  const extra_preferences = useState(new Set());
  const recipe_idx = useState(0);
  const [recipe_count, set_recipe_count] = useState(1); // initial value

  const generate_event = () => {
    recipe_idx[1](0)
    let data = {
      vegan: vegan.current?.checked,
      vegetarian: vegetarian.current?.checked,
      glutenfree: glutenfree.current?.checked,
      ingredients: ingredients.current?.value,
      extra_preferences: [...extra_preferences[0]],
      num_recipes: recipe_count
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
          if(res2.status == "done" || res2.status == "error" || res2.status == "rejected"){
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
        <textarea className='ingredients' ref={ingredients} onChange={(e) => {
          if(e.target.value == ""){
            set_send_disabled(true);
          }else{
            set_send_disabled(false);
          }
        }}></textarea>
        <label>Zusßtzliche optionen:</label>
        <div>
          <Preference_element label="vegan" ref={vegan} />
          <Preference_element label="vegetarisch" ref={vegetarian} />
          <Preference_element label="glutenfrei" ref={glutenfree} />
        </div>
        <label>Zubereitungspräferenzen:</label>
        <div className='extra_options_container'>
          <ToggleTag text="schnell" target={extra_preferences}/>
          <ToggleTag text="Mikrowelle" target={extra_preferences}/>
          <ToggleTag text="Backofen" target={extra_preferences}/>
          <ToggleTag text="Pfanne" target={extra_preferences}/>
          <ToggleTag text="Heißluftfritöse" target={extra_preferences}/>
          <ToggleTag text="kein kochen" target={extra_preferences}/>
          <ToggleTag text="5 Zutaten" target={extra_preferences}/>
          <ToggleTag text="wenig Zutaten" target={extra_preferences}/>
        </div>
        <label>Einstellungen:</label>
        <div>
          Anzahl der rezepte:
          <button className='number_input_btn' onClick={()=>{
            set_recipe_count(recipe_count-1)
          }} disabled={recipe_count<=1}>-</button>
          <input className='number_input' type='number' min="1" max="5" value={recipe_count} onChange={(e) => {
            const val = Number(e.target.value);

            // Optional: enforce the range
            if (val >= 1 && val <= 10) {
              set_recipe_count(val);
            }
          }}></input>
          <button className='number_input_btn' onClick={()=>{
            set_recipe_count(recipe_count+1)
          }} disabled={recipe_count>=5}>+</button>
        </div>
        <button onClick={
          generate_event
        } className='generate_btn' ref={send_btn} disabled={send_disabled}>Rezepte finden</button>
      </div>
      <RecipesOutput state={recipes} generate_function={generate_event} recipe_idx={recipe_idx}/>
      
    </>
  )
}
export default App
