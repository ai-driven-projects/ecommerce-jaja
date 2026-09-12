import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./estilos/global.css";
import { Acompanhar } from "./telas/Acompanhar";
import { Checkout } from "./telas/Checkout";
import { Produto } from "./telas/Produto";
import { Vitrine } from "./telas/Vitrine";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Vitrine />} />
      <Route path="/p/:slug" element={<Produto />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/pedidos/:id/acompanhar" element={<Acompanhar />} />
    </Routes>
  </BrowserRouter>
);
