require("dotenv").config();
const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";



console.log("API KEY used:", process.env.spooncular_apiKey);


/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */


async function getRecipeInformation(recipe_id) {
    console.log('=== DEBUG: getRecipeInformation called ===');
    console.log('Recipe ID:', recipe_id);
    console.log('URL being called:', `${api_domain}/${recipe_id}/information`);
    
    const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
            includeNutrition: false,
            apiKey: process.env.spooncular_apiKey
        }
    });
    
    console.log('Recipe information received successfully');
    return response;
}


async function getRecipeDetails(recipe_id) {
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree } = recipe_info.data;

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        
    }
}

// Receiving preparation steps and required equipment
async function getAnalyzedInstructions(recipeId) {
  const response = await axios.get(`${api_domain}/${recipeId}/analyzedInstructions`, {
    params: {
      apiKey: process.env.spooncular_apiKey
    }
  });

  // Returns all steps and required equipment
  return response.data; // array of instruction blocks
}


async function searchRecipe(recipeName, cuisine, diet, intolerance, number) {
    // console.log("🍝 search params:", { recipeName, cuisine, diet, intolerance, number });
    // console.log("🔑 API Key:", api_key);
    const response = await axios.get(`${api_domain}/complexSearch`, {
        params: {
            query: recipeName,
            cuisine: cuisine,
            diet: diet,
            intolerances: intolerance,
            number: number,
            apiKey: process.env.spooncular_apiKey
        }
    });

    if (!response.data.results || response.data.results.length === 0) {
        return []; 
    }
    // Use Promise.all to fetch details for each recipe ID
    const recipeDetails = await Promise.all(response.data.results.map(element => getRecipeDetails(String(element.id))));
    return recipeDetails;

    //return getRecipeDetails(response.data.results.map((element) => element.recipe_id));
}


/**
 * Get random recipes from Spoonacular API
 * @param {number} number - Number of random recipes to fetch
 */
async function getRandomRecipes(number = 3) {
  try {
    console.log('=== DEBUG: getRandomRecipes called ===');
    console.log('API Key:', process.env.spooncular_apiKey);
    console.log('Number of recipes requested:', number);
    
    const url = `${api_domain}/random`;
    const params = {
      apiKey: process.env.spooncular_apiKey,
      number: number
    };
    
    console.log('URL being called:', url);
    console.log('Parameters:', params);
    
    const response = await axios.get(url, { params });
    
    console.log('Response received successfully');
    console.log('Number of recipes returned:', response.data.recipes?.length || 0);
    
    return response.data.recipes;
  } catch (error) {
    console.error('=== ERROR in getRandomRecipes ===');
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Full error:', error);
    throw error;
  }
}

async function getFullRecipeFromSpoonacular(recipe_id) {
  const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
    params: {
      includeNutrition: false,
      apiKey: process.env.spooncular_apiKey
    }
  });

  const data = response.data;

  return {
    id: data.id,
    title: data.title,
    readyInMinutes: data.readyInMinutes,
    image: data.image,
    popularity: data.aggregateLikes,
    vegan: data.vegan,
    vegetarian: data.vegetarian,
    glutenFree: data.glutenFree,
    servings: data.servings,
    ingredients: data.extendedIngredients?.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit
    })) || [],
    instructions: data.instructions || "No instructions available"
  };
}







exports.getAnalyzedInstructions = getAnalyzedInstructions;
exports.getRecipeDetails = getRecipeDetails;
exports.getRecipeInformation = getRecipeInformation;
exports.searchRecipe = searchRecipe;
exports.getRandomRecipes = getRandomRecipes
exports.getFullRecipeFromSpoonacular = getFullRecipeFromSpoonacular;







