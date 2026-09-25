import type { Food } from './types'

// A small built-in database of common foods. Values are per serving and rounded;
// they are typical figures (USDA-style), good enough for everyday tracking.
// [name, serving label, grams, kcal, protein, fat, carbs]
type Row = [string, string, number, number, number, number, number]

const ROWS: Row[] = [
  // Protein
  ['Chicken breast, cooked', '100 g', 100, 165, 31, 3.6, 0],
  ['Chicken thigh, cooked', '100 g', 100, 209, 26, 10.9, 0],
  ['Ground beef 90% lean, cooked', '100 g', 100, 217, 26, 11.7, 0],
  ['Ground turkey 93% lean, cooked', '100 g', 100, 176, 23, 9, 0],
  ['Sirloin steak, cooked', '100 g', 100, 206, 29, 9, 0],
  ['Salmon, cooked', '100 g', 100, 206, 22, 12, 0],
  ['Tuna, canned in water', '1 can (142 g)', 142, 170, 38, 1.2, 0],
  ['Shrimp, cooked', '100 g', 100, 99, 24, 0.3, 0.2],
  ['Tofu, firm', '100 g', 100, 144, 17, 9, 3],
  ['Egg, whole', '1 large', 50, 72, 6.3, 4.8, 0.4],
  ['Egg whites', '100 g', 100, 52, 11, 0.2, 0.7],
  ['Bacon, cooked', '1 slice', 8, 43, 3, 3.3, 0.1],
  ['Deli turkey', '2 oz (56 g)', 56, 60, 10, 1, 2],
  ['Whey protein powder', '1 scoop (30 g)', 30, 120, 24, 1.5, 3],
  // Dairy
  ['Greek yogurt, nonfat plain', '170 g', 170, 100, 17, 0.7, 6],
  ['Greek yogurt, 2% plain', '170 g', 170, 130, 17, 3.5, 7],
  ['Cottage cheese, 2%', '1/2 cup (113 g)', 113, 90, 12, 2.5, 5],
  ['Milk, 2%', '1 cup (244 g)', 244, 122, 8, 4.8, 12],
  ['Milk, skim', '1 cup (245 g)', 245, 83, 8, 0.2, 12],
  ['Cheddar cheese', '1 oz (28 g)', 28, 114, 7, 9.4, 0.4],
  ['Mozzarella, part skim', '1 oz (28 g)', 28, 72, 7, 4.5, 0.8],
  ['Butter', '1 tbsp (14 g)', 14, 102, 0.1, 11.5, 0],
  // Grains & starches
  ['White rice, cooked', '1 cup (158 g)', 158, 205, 4.3, 0.4, 45],
  ['Brown rice, cooked', '1 cup (195 g)', 195, 216, 5, 1.8, 45],
  ['Oats, rolled (dry)', '1/2 cup (40 g)', 40, 150, 5, 2.5, 27],
  ['Pasta, cooked', '1 cup (140 g)', 140, 221, 8, 1.3, 43],
  ['Quinoa, cooked', '1 cup (185 g)', 185, 222, 8, 3.6, 39],
  ['Bread, whole wheat', '1 slice (32 g)', 32, 80, 4, 1, 14],
  ['Bread, white', '1 slice (25 g)', 25, 67, 2, 0.8, 13],
  ['Bagel, plain', '1 medium (105 g)', 105, 277, 11, 1.4, 55],
  ['Flour tortilla', '1 medium (45 g)', 45, 140, 4, 3.5, 24],
  ['Corn tortilla', '1 small (26 g)', 26, 57, 1.5, 0.7, 12],
  ['Potato, baked', '1 medium (173 g)', 173, 161, 4.3, 0.2, 37],
  ['Sweet potato, baked', '1 medium (114 g)', 114, 103, 2.3, 0.2, 24],
  ['Granola', '1/2 cup (60 g)', 60, 270, 6, 10, 38],
  ['Cereal, corn flakes', '1 cup (28 g)', 28, 100, 2, 0, 24],
  // Fruit
  ['Banana', '1 medium (118 g)', 118, 105, 1.3, 0.4, 27],
  ['Apple', '1 medium (182 g)', 182, 95, 0.5, 0.3, 25],
  ['Orange', '1 medium (131 g)', 131, 62, 1.2, 0.2, 15],
  ['Blueberries', '1 cup (148 g)', 148, 84, 1.1, 0.5, 21],
  ['Strawberries', '1 cup (152 g)', 152, 49, 1, 0.5, 12],
  ['Grapes', '1 cup (151 g)', 151, 104, 1.1, 0.2, 27],
  ['Avocado', '1/2 fruit (68 g)', 68, 114, 1.3, 10.5, 6],
  ['Mango', '1 cup (165 g)', 165, 99, 1.4, 0.6, 25],
  // Vegetables
  ['Broccoli', '1 cup (91 g)', 91, 31, 2.5, 0.3, 6],
  ['Spinach, raw', '2 cups (60 g)', 60, 14, 1.7, 0.2, 2.2],
  ['Mixed salad greens', '2 cups (85 g)', 85, 15, 1.2, 0.2, 2.9],
  ['Carrots', '1 medium (61 g)', 61, 25, 0.6, 0.1, 6],
  ['Bell pepper', '1 medium (119 g)', 119, 31, 1, 0.4, 7],
  ['Tomato', '1 medium (123 g)', 123, 22, 1.1, 0.2, 4.8],
  ['Cucumber', '1 cup (104 g)', 104, 16, 0.7, 0.1, 3.8],
  ['Green beans', '1 cup (125 g)', 125, 44, 2.4, 0.4, 10],
  ['Onion', '1/2 medium (55 g)', 55, 22, 0.6, 0.1, 5],
  ['Black beans, cooked', '1/2 cup (86 g)', 86, 114, 7.6, 0.5, 20],
  ['Chickpeas, cooked', '1/2 cup (82 g)', 82, 134, 7.3, 2.1, 22],
  ['Lentils, cooked', '1/2 cup (99 g)', 99, 115, 9, 0.4, 20],
  // Fats, nuts & condiments
  ['Olive oil', '1 tbsp (14 g)', 14, 119, 0, 13.5, 0],
  ['Peanut butter', '2 tbsp (32 g)', 32, 190, 7, 16, 7],
  ['Almonds', '1 oz (28 g)', 28, 164, 6, 14, 6],
  ['Walnuts', '1 oz (28 g)', 28, 185, 4.3, 18.5, 3.9],
  ['Hummus', '2 tbsp (30 g)', 30, 70, 2, 5, 4],
  ['Mayonnaise', '1 tbsp (14 g)', 14, 94, 0.1, 10, 0.1],
  ['Ketchup', '1 tbsp (17 g)', 17, 17, 0.2, 0, 4.5],
  ['Honey', '1 tbsp (21 g)', 21, 64, 0.1, 0, 17],
  ['Maple syrup', '1 tbsp (20 g)', 20, 52, 0, 0, 13],
  // Meals & snacks
  ['Pizza, cheese', '1 slice (107 g)', 107, 285, 12, 10, 36],
  ['Cheeseburger', '1 burger (150 g)', 150, 400, 21, 20, 33],
  ['Burrito bowl, chicken', '1 bowl (500 g)', 500, 650, 45, 22, 70],
  ['Protein bar', '1 bar (60 g)', 60, 210, 20, 7, 23],
  ['Potato chips', '1 oz (28 g)', 28, 152, 2, 10, 15],
  ['Dark chocolate 70%', '1 oz (28 g)', 28, 170, 2.2, 12, 13],
  ['Ice cream, vanilla', '1/2 cup (66 g)', 66, 137, 2.3, 7.3, 16],
  ['Popcorn, air-popped', '3 cups (24 g)', 24, 93, 3, 1.1, 19],
  ['Rice cake', '1 cake (9 g)', 9, 35, 0.7, 0.3, 7.3],
  // Drinks
  ['Coffee, black', '1 cup (240 g)', 240, 2, 0.3, 0, 0],
  ['Orange juice', '1 cup (248 g)', 248, 112, 1.7, 0.5, 26],
  ['Cola', '1 can (355 ml)', 368, 140, 0, 0, 39],
  ['Beer', '1 can (355 ml)', 356, 153, 1.6, 0, 13],
  ['Red wine', '5 fl oz (147 g)', 147, 125, 0.1, 0, 3.8],
  ['Oat milk', '1 cup (240 g)', 240, 120, 3, 5, 16],
  ['Almond milk, unsweetened', '1 cup (240 g)', 240, 30, 1, 2.5, 1],
]

export const BUILTIN_FOODS: Food[] = ROWS.map(([name, servingLabel, servingGrams, calories, protein, fat, carbs], i) => ({
  id: `b${i}`,
  name,
  servingLabel,
  servingGrams,
  per: { calories, protein, fat, carbs },
}))

export function searchFoods(foods: Food[], query: string): Food[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return foods
  return foods
    .map((f) => {
      const hay = `${f.name} ${f.brand ?? ''}`.toLowerCase()
      if (!terms.every((t) => hay.includes(t))) return null
      // Rank: names starting with the query first, then shorter names.
      const score = (hay.startsWith(terms[0]) ? 0 : 1) * 1000 + hay.length
      return { f, score }
    })
    .filter((x): x is { f: Food; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.f)
}
