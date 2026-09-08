import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
// Browser-only application. No API, Worker, auth or database bindings.
export default defineConfig({plugins:[react()],css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},server:{host:'127.0.0.1',port:5173,strictPort:true},build:{outDir:'dist',sourcemap:true}});
