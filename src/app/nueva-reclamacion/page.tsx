'use client';
import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // <-- Fíjate en los dos puntos dobles para subir dos niveles

export default function NuevaReclamacion() {
  const [formData, setFormData] = useState({
    bodega: '', producto: '', cliente: '', tipoAportacion: '', tipoOtro: '', observaciones: ''
  });
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlBodega = params.get('bodega');
      if (urlBodega) {
        setFormData(prev => ({ ...prev, bodega: urlBodega }));
      }
    }
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const tipoFinal = formData.tipoAportacion === 'Otro' ? formData.tipoOtro : formData.tipoAportacion;
    const productoFinal = formData.producto.trim() === '' ? 'Toda la bodega' : formData.producto.trim();
    const clienteFinal = formData.cliente.trim() === '' ? 'Todos los clientes' : formData.cliente.trim();

    const nuevoAcuerdo = {
      id: Date.now(),
      bodega: formData.bodega.trim(),
      producto: productoFinal,
      cliente: clienteFinal,
      tipoAportacion: tipoFinal,
      observaciones: formData.observaciones.trim(),
      reclamaciones: [],
      destacado: false
    };

    try {
      // MAGIA DE FIREBASE: Guarda en la nube
      await setDoc(doc(db, 'acuerdos', nuevoAcuerdo.id.toString()), nuevoAcuerdo);
      setMensaje('¡Acuerdo guardado en la nube ☁️! Redirigiendo...');
      setTimeout(() => { window.location.href = '/'; }, 1000);
    } catch (error) {
      console.error("Error guardando en Firebase:", error);
      alert("Hubo un error de conexión con la base de datos.");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Nuevo Acuerdo Base</h1>
        <a href="/" className="text-blue-600 underline hover:text-blue-800 transition">Volver al Dashboard</a>
      </div>
      
      {mensaje && <div className="bg-blue-50 border border-blue-200 p-4 mb-4 text-blue-700 rounded-lg font-bold shadow-sm">{mensaje}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Bodega *</label>
            <input value={formData.bodega} className="border border-slate-300 p-2 rounded w-full focus:ring-2 focus:ring-blue-400 focus:outline-none" required onChange={e => setFormData({...formData, bodega: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Producto (Opcional)</label>
            <input placeholder="Genérico si se deja en blanco" className="border border-slate-300 p-2 rounded w-full bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none" onChange={e => setFormData({...formData, producto: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Cliente (Opcional)</label>
            <input placeholder="Todos si se deja en blanco" className="border border-slate-300 p-2 rounded w-full bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none" onChange={e => setFormData({...formData, cliente: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Aportación *</label>
            <select className="border border-slate-300 p-2 rounded w-full focus:ring-2 focus:ring-blue-400 focus:outline-none" required onChange={e => setFormData({...formData, tipoAportacion: e.target.value})}>
              <option value="">Seleccionar...</option>
              <option value="Botellas sin cargo">Botellas sin cargo</option>
              <option value="% de descuento">% de descuento</option>
              <option value="Rápel">Rápel</option>
              <option value="Otro">Otro...</option>
            </select>
          </div>
        </div>
        
        {formData.tipoAportacion === 'Otro' && (
          <input placeholder="Especificar motivo..." className="border border-slate-300 p-2 w-full rounded focus:ring-2 focus:ring-blue-400 focus:outline-none bg-blue-50" onChange={e => setFormData({...formData, tipoOtro: e.target.value})} />
        )}
        
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Observaciones</label>
          <textarea placeholder="Condiciones, comentarios, cómo te lo abonan..." className="border border-slate-300 p-2 w-full rounded focus:ring-2 focus:ring-blue-400 focus:outline-none min-h-[80px]" onChange={e => setFormData({...formData, observaciones: e.target.value})} />
        </div>
        
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-md cursor-pointer transition">
          Guardar Acuerdo en la Nube
        </button>
      </form>
    </div>
  );
}