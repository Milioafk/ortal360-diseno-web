import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api':{target:'https://portal360-api.onrender.com',changeOrigin:true}}}});