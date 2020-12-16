# optimalBulletdodger
A bullet dodging algorithm that utilizes a modified version of dijkstras shortest path algorithm/Modified A*.

## The problem
Given a square object(Called tank) that can move 1 unit per timestep and two units when using boosts.
The incoming bullets have constant speed, and angel and speed is known.
The incoming bullets come in facing front or back of the tank, and not directly the side of the tank. (So its possible to move sideways to dodge bullets)
The tank has a radar that can see bullets, and for simplicity, it sees all bullets.

We optimize on the following things (where 1. has highest cost/highest priority, and list is sorted by priority)
1. Avoid crashing with the incoming bullets.
2. Try to go to a desired position (in demo it is a constant position in the middle of the screen)
3. Try to avoid using boost.

The view-length of the algorithm has been reduced to be 100 length units in front of the tank. And it is then constrained in the
x-plane of the tank by the boost speed that is 2 units per length in front.

## Demo
https://cbratli.github.io/

## Get started-1
1) Download the code
2) Open index.html in a browser that supports class syntax.

## Get started-2

Download .NET Core [2.1](https://get.dot.net) or newer.
Once installed, run this command:

```
dotnet tool install --global dotnet-serve
```

Start a simple server and open the browser by running

```
dotnet serve -o
```
