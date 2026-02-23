FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy worker source
COPY . .

# Run the worker
CMD ["npm", "start"]
