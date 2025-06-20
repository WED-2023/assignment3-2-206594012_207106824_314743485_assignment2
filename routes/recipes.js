require("dotenv").config();
var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipes_utils = require("./utils/recipes_utils");



router.get("/", (req, res) => res.send("im here"));

/**
 * This path returns 3 random recipes
 */
router.get("/random", async (req, res, next) => {
  try {
    let recipesDetailsArray = [];
    while (recipesDetailsArray.length < 3) {
      const recipes = await recipes_utils.getRandomRecipes(3 - recipesDetailsArray.length);
      const recipeIds = recipes.map(recipe => String(recipe.id));
      for (let recipeId of recipeIds) {
        try {
          const recipeDetails = await recipes_utils.getRecipeDetails(recipeId);
          recipesDetailsArray.push(recipeDetails);
        } catch (error) {
          console.error(`Error fetching details for recipe ID ${recipeId}:`, error);
        }
        if (recipesDetailsArray.length === 3) break;
      }
    }
    res.status(200).send(recipesDetailsArray);
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns a full details of a recipe by its id - preview presentation
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const recipe = await recipes_utils.getRecipeDetails(recipeId);

    //add the recipeId for last watched
    const username = req.session.username;
    if (username) {
      await user_utils.saveWatchedRecipeToDB(username, recipeId);
    }

    res.send(recipe);
  } catch (error) {
    next(error);
  }
});



router.get("/:recipeId/prepare", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;

    // saving the recipe in req.session.mealPlan
    if (!req.session.mealPlan) req.session.mealPlan = [];

    const alreadyExists = req.session.mealPlan.find(r => r.recipeID === recipeId);
    if (!alreadyExists) {
      const newOrder = req.session.mealPlan.length + 1;
      req.session.mealPlan.push({ recipeID: recipeId, orderIndex: newOrder });
    }

    // Fetch step-by-step preparation instructions from the external Spoonacular API 
    const instructions = await recipes_utils.getAnalyzedInstructions(recipeId);

    // Initialize session object for tracking preparation progress, if not already initialized
    if (!req.session.preparationProgress) {
      req.session.preparationProgress = {};
    }

    // Initialize progress tracking for the specific recipe if this is the first time it's accessed
    if (!req.session.preparationProgress[recipeId]) {
      req.session.preparationProgress[recipeId] = {
        completedSteps: []  //this will store indices of steps the user has marked as completed
      };
    }

    //Send both the instructions and the current progress status back to the frontend
    res.status(200).send({
      instructions: instructions,
      progress: req.session.preparationProgress[recipeId]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * This path return the query search results 
 */
router.get("/search", async (req, res, next) => {
  try {
    const query  = req.query.query;
    const cuisine = req.query.cuisine;
    const diet = req.query.diet;
    const intolerances = req.query.intolerances;
    const number = req.query.number || 5;

    const results = await recipes_utils.searchRecipe(query, cuisine, diet, intolerances, number);
    res.send(results);
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns a full recipe from Spoonacular by its ID
 */
router.get("/fullview/:recipeId", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId.trim();
    const recipe = await recipes_utils.getFullRecipeFromSpoonacular(recipeId);
    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
});








module.exports = router;