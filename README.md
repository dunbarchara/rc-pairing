
This is the foundation for the Recurse Center pairing interview

## game.ts

This is the main file we will edit for game logic

It holds a definition for our `Map` class that is used to represent a map as a 2D array of characters. `Asset`s (like buildings) can be placed in the map before the game starts.

The game in its current state renders a viewbox centered around the character. It only renders the portion of the map that fits within the viewbox relative to the character.

The character is represented with a 'C' character.

After each render, the game awaits user input (WASD) which will update the character position and re-render the viewbox.

## assets/

This folder holds our txt asset files

## RC Pairing Tasks

- Implement Collision - currently the character can walk through everything and 'leave' the map as well
- Implement Hide and Seek - add NPC's represented by 'N' that you have to find and interact with, finding all of them should trigger a winning message
    - (Could also do something like Zombie hunting, where we shoot projectiles at zombies represented by 'Z')

Stretch Goals (options):
- Implement shifting NPCs to make it harder
- Implement interactive NPCs - some conversational phase we have to build, maybe the NPCs make us answer math problems or something
- Any fun suggestions from the RC Faculty/Alum?

