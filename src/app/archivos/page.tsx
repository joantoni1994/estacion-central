'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, Download, FileSpreadsheet, FolderOpen } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ArchivosGuardados() {
  const [archivos, setArchivos] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'archivos_promos'), (snapshot) => {
      setArchivos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const descargarArchivo = (archivo: any) => {
    try {
      const datos = JSON.parse(archivo.datosExcel);
      const nuevaHoja = XLSX.utils.aoa_to_sheet(datos);
      const nuevoLibro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Promos");
      XLSX.writeFile(nuevoLibro, `Promos_${archivo.bodega}_${archivo.nombrePeriodo}.xlsx`);
    } catch (e) {
      alert("Error al descargar el archivo.");
    }
  };

  const borrarArchivo = async (id: string) => {
    if(confirm("¿Seguro que quieres borrar este archivo de la nube?")) {
      await deleteDoc(doc(db, 'archivos_promos', id));
    }
  };

  // Agrupamos los archivos por bodega
  const agrupados = archivos.reduce((acc, obj) => {
    const key = obj.bodega || 'SIN BODEGA';
    if (!acc[key]) acc[key] = [];
    acc[key].push(obj);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b pb-4 flex items-center gap-3">
        <FolderOpen size={32} className="text-slate-700" />
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Archivos Guardados</h1>
          <p className="text-slate-500 mt-1">Historial de todos los Excels vinculados a tus reclamaciones.</p>
        </div>
      </div>

      {archivos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileSpreadsheet size={64} className="mx-auto mb-4 opacity-20" />
          <p>Aún no has guardado ningún archivo desde el Analizador.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupados).map(([bodega, lista]: [string, any]) => (
            <div key={bodega} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3 font-bold uppercase tracking-wider">
                {bodega}
              </div>
              <div className="divide-y divide-gray-100">
                {lista.map((archivo: any) => (
                  <div key={archivo.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">Periodo: {archivo.nombrePeriodo}</span>
                        <span className="text-slate-400 text-xs">{new Date(archivo.fechaSubida).toLocaleDateString('es-ES')}</span>
                      </div>
                      <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">{archivo.totalBotellas}</span> botellas sin cargo detectadas.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => descargarArchivo(archivo)} className="flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded font-bold text-sm transition">
                        <Download size={16} /> Descargar Excel
                      </button>
                      <button onClick={() => borrarArchivo(archivo.id)} className="text-slate-300 hover:text-red-500 p-1.5 transition">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}