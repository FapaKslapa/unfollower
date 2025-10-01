# Unfollower

Unfollower is a simple application written in TypeScript that helps users manage and clean up their social media following lists. The app allows you to track accounts you follow, identify inactive or irrelevant users, and unfollow them efficiently. It is designed to be lightweight and user-friendly, making social media management easier and faster.

## Features

- Scan your following list and detect inactive or non-reciprocal accounts
- Batch unfollow users with a single click
- Export your following/unfollowing data
- Simple CLI interface for quick actions

## Requirements

- [Node.js](https://nodejs.org/) (version 14 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/FapaKslapa/unfollower.git
   cd unfollower
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   ```
4. **Run the application:**

   ```bash
   npm start
   # or
   yarn start
   ```

   Depending on the implementation, you may need to use:

   ```bash
   node dist/index.js
   ```

   or

   ```bash
   npx ts-node src/index.ts
   ```

## Build

To compile the TypeScript source code to JavaScript, run:

```bash
npm run build
# or
yarn build
```

## Usage

The application is typically run from the command line. You can use various options to customize your experience. For example:

```bash
npm start -- --help
```

or

```bash
node dist/index.js --help
```

to see all available commands.

## Contributing

Contributions are welcome! Please fork the repository and open a p

## License

This project is licensed under the MIT License.
