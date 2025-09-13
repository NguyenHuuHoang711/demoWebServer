import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { Socket } from 'socket.io-client';
import { fetcher } from '../../api/base';

interface Chat {
  _id: string;
  product: { _id: string; name: string; price: number; discount?: number; images?: { image: string }[] };
  messages: { sender: { _id: string; name: string }; content: string; timestamp: string; is_read: boolean }[];
  user: { _id: string; name: string }[];
}

interface UserChatComponentProps {
  productId: string;
  product: { _id: string; name: string; price: number; discount?: number; images?: { image: string }[] };
  onClose: () => void;
  userId: string;
}

interface ChatErrorResponse {
  success: false;
  message: string;
}
interface ChatSuccessResponse {
  success: true;
  message: string;
  data: [];
}

type ChatResponse = ChatErrorResponse | ChatSuccessResponse;

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error('Please log in to continue');
    throw new Error('No token found');
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const response = await fetch(`http://localhost:3001${url}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const errorData = await response.json();
    if (response.status === 403 && errorData.message === 'Token expired. Please log in again.') {
      toast.error('Session expired. Please log in again.');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    toast.error(errorData.message || `HTTP error! status: ${response.status}`);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
};

const UserChatComponent: React.FC<UserChatComponentProps> = ({ productId, product, onClose, userId }) => {
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);
  const [token, setToken] = useState(`Bearer ${localStorage.getItem('token')}`);
  const [sessions, setSessions] = useState([]);

  const fetchSessionsByUserId = async () => {
    try {
      const chats = await fetcher<ChatResponse>(`/chats/user/${localStorage.getItem('userId')}`, { method: 'GET' }, token);
      if (chats.success) {
        setSessions(chats.data);
        console.log('session:', sessions);
      } else {
        throw console.error(chats.message);
      }
    } catch (e) {
      throw console.error(e);
    }
  };

  useEffect(() => {
    console.log('fetching sessions by userId');
    setToken(`Bearer ${localStorage.getItem('token')}`);
    if (token) {
      fetchSessionsByUserId();
    }
  }, []);

  useEffect(() => {
    if (!token) {
      toast.error('Please log in to start chatting');
      return;
    }

    socketRef.current = io('http://localhost:3001', { auth: { token } });
    socketRef.current.emit('user_connected', userId);

    socketRef.current.on('receive-message', (newMessage) => {
      if (newMessage.session_id === selectedChat?._id) {
        setSelectedChat((prev) => (prev ? { ...prev, messages: [...prev.messages, newMessage] } : prev));
      }
      setChatList((prev) =>
        prev.map((chat) =>
          chat._id === newMessage.session_id ? { ...chat, messages: [...chat.messages, newMessage] } : chat
        )
      );
    });

    return () => {
      socketRef.current?.emit('leave-session', selectedChat?._id);
      socketRef.current?.disconnect();
    };
  }, [userId, selectedChat?._id, token]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetchWithAuth(`/api/v1/chats?productId=${productId}&userId=${userId}&page=1&limit=10`);
        const data = await response.json();
        if (data.success) setChatList(data.chats);
        else toast.error(data.message || 'Failed to load chats');
      } catch (error) {
        console.error('Error fetching chats:', error);
        toast.error('Failed to load chats');
      }
    };
    fetchChats();
  }, [productId, userId]);

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat) {
      toast.error('Vui lòng nhập tin nhắn');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/v1/chats/messages', {
        method: 'POST',
        body: JSON.stringify({ chatId: selectedChat._id, content: message }),
      });
      const data = await response.json();
      if (data.success) {
        const newMsg = data.chat.messages[data.chat.messages.length - 1];
        setSelectedChat((prev) => (prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev));
        setChatList((prev) =>
          prev.map((chat) =>
            chat._id === selectedChat._id ? { ...chat, messages: [...chat.messages, newMsg] } : chat
          )
        );
        setMessage('');
      } else toast.error(data.message || 'Gửi tin nhắn thất bại.');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Gửi tin nhắn thất bại.');
    }
  };

  const startNewChat = async () => {
    const token = localStorage.getItem('token');
    if (!token) return toast.error('Please log in to start a new chat');
    try {
      const adminId = import.meta.env.VITE_ADMIN_ID;
      if (!adminId) return toast.error('Admin ID is not configured.');
      const response = await fetchWithAuth('/api/v1/chats', {
        method: 'POST',
        body: JSON.stringify({ senderId: userId, recipientId: adminId, productId }),
      });
      const data = await response.json();
      if (data.success) {
        setChatList([...chatList, data.data]);
        setSelectedChat(data.data);
        toast.success('Chat đã được tạo!');
      } else toast.error(data.message || 'Tạo chat thất bại');
    } catch (error) {
      toast.error('Tạo chat thất bại');
    }
  };

  const finalPrice = product ? product.price - (product.price * (product.discount || 0)) / 100 : 0;
  const productImage = product?.images?.[0]?.image || 'https://via.placeholder.com/50';

  return (
    <div style={{
      position: 'fixed', bottom: '90px', right: '20px', width: '650px',
      background: '#fff', borderRadius: '10px', boxShadow: '0 0 15px rgba(0,0,0,0.15)', display: 'flex', height: '450px',
      fontFamily: 'Segoe UI, sans-serif', overflow: 'hidden', zIndex: 1000,
    }}>
      {/* Sidebar */}
      <div style={{ width: '220px', background: '#f9f9f9', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
          <strong>Chat với Cửa hàng</strong>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>
        {chatList.length > 0 ? (
          chatList.map((chat) => (
            <div
              key={chat._id}
              onClick={() => setSelectedChat(chat)}
              style={{
                padding: '10px 12px', cursor: 'pointer', backgroundColor: selectedChat?._id === chat._id ? '#e6f7ff' : 'transparent',
                borderBottom: '1px solid #eee',
              }}
            >
              <div style={{ fontWeight: 600 }}>{chat.user.find((u) => u._id !== userId)?.name || 'Admin'}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>{chat.messages.at(-1)?.content || '...'}</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>{new Date(chat.messages.at(-1)?.timestamp || '').toLocaleDateString()}</div>
            </div>
          ))
        ) : (
          <div style={{ padding: '15px' }}>
            <p>Chưa có cuộc trò chuyện nào.</p>
            <button
              onClick={startNewChat}
              style={{ padding: '6px 12px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '5px' }}
            >
              Tạo chat mới
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, padding: '15px', display: 'flex', flexDirection: 'column' }}>
        {selectedChat ? (
          <>
            <div style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '8px', padding: '10px', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={productImage} alt={product?.name} style={{ width: '50px', height: '50px', borderRadius: '6px' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{product?.name}</div>
                  <div style={{ color: '#999' }}>Hiển thị: {finalPrice.toLocaleString('vi-VN')}₫</div>
                  <div style={{ color: '#ccc', fontSize: '13px' }}>ID: {productId}</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedChat.messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender._id === userId ? 'flex-end' : 'flex-start',
                    background: msg.sender._id === userId ? '#d2f7e5' : '#f1f1f1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    maxWidth: '75%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = msg.sender._id === userId ? '#b0e8d2' : '#e0e0e0')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = msg.sender._id === userId ? '#d2f7e5' : '#f1f1f1')}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{msg.sender.name}</div>
                  <div style={{ marginTop: '4px' }}>{msg.content}</div>
                  <div style={{ fontSize: '11px', color: '#888', textAlign: 'right', marginTop: '4px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()} {msg.is_read && msg.sender._id !== userId && ' (Đã đọc)'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }}
              />
              <button
                onClick={sendMessage}
                style={{ padding: '8px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1677ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1890ff')}
              >
                Gửi
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '50%' }}>Chọn một cuộc trò chuyện để bắt đầu.</div>
        )}
      </div>
    </div>
  );
};

export default UserChatComponent;