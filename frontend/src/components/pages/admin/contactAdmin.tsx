import { useEffect, useState } from "react";

const ContactManagement = () => {
  const [contactList, setContactList] = useState<any[]>([]);

  // Lấy danh sách bài viết
  useEffect(() => {
        fetchContactList();
  }, []);

    const fetchContactList = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/v1/contacts', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        console.log(data)
        if (Array.isArray(data.data)) {
          setContactList(data.data);
        } else {
          setContactList([]);
        }
      } catch (error) {
        console.error('Lỗi khi tải danh sách bài viết:', error);
      }
    };


  return (
    <div className="sp-section">
      <h2 className="form-title">Top sản phẩm được đánh giá cao</h2>

      {contactList.length === 0 ? (
        <p>Không có sản phẩm nào được đánh giá.</p>
      ) : (
        <div className="sp-list">
          {contactList.map((product) => {
            return (
              <div key={product._id} className="sp-card">
                <div className="sp-info">
                  <div className="sp-content">
                    <h3 className="sp-name">{product.name || 'Sản phẩm không tên'}</h3>
                    <p><strong>Email:</strong> {product.email}</p>
                    <p><strong>SĐT:</strong> {product.phone}</p>
                    <p><strong>tiêu đề:</strong> {product.title || 'Không có'}</p>
                    <p><strong>lời nhắn:</strong> {product.description || 'Không có'}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactManagement;
