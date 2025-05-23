const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";

console.log("🔐 API KEY used:", process.env.spooncular_apiKey);


/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */


async function getRecipeInformation(recipe_id) {
    return await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
            includeNutrition: false,
            apiKey: process.env.spooncular_apiKey
        }
    });
}

//need to add also ingerdients, instructuons ...
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



exports.getAnalyzedInstructions = getAnalyzedInstructions;
exports.getRecipeDetails = getRecipeDetails;



