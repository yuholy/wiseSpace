import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const reactAliases = {
  'react': resolve(rootDir, 'node_modules/react'),
  'react-dom': resolve(rootDir, 'node_modules/react-dom'),
  'react/jsx-runtime': resolve(rootDir, 'node_modules/react/jsx-runtime.js'),
  'react/jsx-dev-runtime': resolve(rootDir, 'node_modules/react/jsx-dev-runtime.js'),
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['markstream-react', 'stream-markdown-parser'],
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ...reactAliases,
      }
    }
    return config
  },
}

export default nextConfig
