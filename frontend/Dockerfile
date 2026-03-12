# Stage 1: Build the frontend
FROM node:18 AS build

WORKDIR /app

# copy package files
COPY package*.json ./

# install dependencies
RUN npm install

# copy project files
COPY . .

# build project
RUN npm run build


# Stage 2: Serve with nginx
FROM nginx:alpine

# copy build files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
