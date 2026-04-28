FROM node:20-slim

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@latest

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（包含 devDependencies 用于构建）
RUN pnpm install --no-frozen-lockfile

# 复制源码
COPY . .

# 构建前端
RUN pnpm exec vite build --outDir dist/public

# 构建服务端
RUN pnpm exec esbuild server/_core/index.ts --bundle --platform=node --packages=external --format=esm --outfile=dist/index.mjs

# 暴露端口
EXPOSE 3000

# 启动服务
ENV NODE_ENV=production
CMD ["node", "dist/index.mjs"]
