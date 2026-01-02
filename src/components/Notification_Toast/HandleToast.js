import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';

const MyComponent = () => {
    const { toasts, removeToast, showSuccess, showError } = useToast();

    const handleSave = () => {
        showSuccess('Data saved successfully!');
        showError('Failed to load data');

    };

    return (
        <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <button onClick={handleSave}>Save</button>
        </>
    );
};