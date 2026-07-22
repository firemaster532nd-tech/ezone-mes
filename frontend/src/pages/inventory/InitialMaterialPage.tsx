import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface MaterialLot {
  id: string;
  lotNumber: string;
  category: string;
  itemName: string;
  density: number | null;
  thickness: number | null;
  width: number | null;
  length: number | null;
  unit: string;
  initialQuantity: number | null;
  location: string;
  supplier: string;
  millSheetLot: string;
  receiveDate: string;
  remarks: string;
}

export function InitialMaterialPage() {
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [formData, setFormData] = useState({
    lotNumber: '',
    category: '세라믹울',
    itemName: '',
    density: '',
    thickness: '',
    width: '',
    length: '',
    unit: 'EA',
    initialQuantity: '',
    location: '본재고',
    supplier: '',
    millSheetLot: '',
    receiveDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const fetchLots = async () => {
    try {
      const response = await api.get('/api/material-lots');
      // If api.get returns axios response, data is in response.data. If fetch, it might be the parsed JSON directly.
      // Adjust based on typical usage, fallback to array if missing.
      const data = response?.data || response || [];
      setLots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    }
  };

  useEffect(() => {
    fetchLots();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lotNumber) {
      alert('LOT 번호를 입력하세요.');
      return;
    }

    try {
      const payload = {
        ...formData,
        density: formData.density ? Number(formData.density) : null,
        thickness: formData.thickness ? Number(formData.thickness) : null,
        width: formData.width ? Number(formData.width) : null,
        length: formData.length ? Number(formData.length) : null,
        initialQuantity: formData.initialQuantity ? Number(formData.initialQuantity) : null,
      };

      await api.post('/api/material-lots', payload);
      alert('LOT이 등록되었습니다.');
      setFormData((prev) => ({
        ...prev,
        lotNumber: '',
        itemName: '',
        density: '',
        thickness: '',
        width: '',
        length: '',
        initialQuantity: '',
        millSheetLot: '',
        remarks: ''
      }));
      fetchLots();
    } catch (error) {
      console.error('Failed to create lot:', error);
      alert('등록에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/api/material-lots/${id}`);
      fetchLots();
    } catch (error) {
      console.error('Failed to delete lot:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">기초재고 등록 (Material LOT)</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">신규 LOT 정보 입력</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LOT번호 (필수)</label>
            <input
              type="text"
              name="lotNumber"
              value={formData.lotNumber}
              onChange={handleChange}
              placeholder="예: 260227CW005"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="세라믹울">세라믹울</option>
              <option value="차열재">차열재</option>
              <option value="그라스울">그라스울</option>
              <option value="그라스울보드">그라스울보드</option>
              <option value="소켓">소켓</option>
              <option value="기타부자재">기타부자재</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">품목명</label>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">밀도(K)</label>
            <input
              type="number"
              name="density"
              value={formData.density}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">두께(T)mm</label>
            <input
              type="number"
              name="thickness"
              value={formData.thickness}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">폭(W)mm</label>
            <input
              type="number"
              name="width"
              value={formData.width}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">길이(L)mm</label>
            <input
              type="number"
              name="length"
              value={formData.length}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기초재고 수량</label>
            <input
              type="number"
              name="initialQuantity"
              value={formData.initialQuantity}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="본재고">본재고</option>
              <option value="출하대기">출하대기</option>
              <option value="시험용">시험용</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">공급업체</label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">밀시트LOT번호</label>
            <input
              type="text"
              name="millSheetLot"
              value={formData.millSheetLot}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">입고일</label>
            <input
              type="date"
              name="receiveDate"
              value={formData.receiveDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="md:col-span-3 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
          >
            LOT 등록
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700">등록된 LOT 목록</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LOT번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">두께(T)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">폭(W)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">위치</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">현재고</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입고일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">삭제</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lots.length > 0 ? (
                lots.map((lot) => (
                  <tr key={lot.id || lot.lotNumber} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lot.lotNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.itemName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {lot.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.thickness ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.width ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{lot.initialQuantity ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lot.receiveDate ? new Date(lot.receiveDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleDelete(lot.id)}
                        className="text-red-600 hover:text-red-900 focus:outline-none"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500">
                    등록된 기초재고 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
