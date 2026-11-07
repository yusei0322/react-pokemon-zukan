type UserCardProps = {
  username: string;
  age: number;
};

const UserCard = ({ username, age }: UserCardProps) => {
  return (
    <div className="user-card">
      <h3>{username}</h3>
      <p>年齢: {age}歳</p>
    </div>
  );
};

export default UserCard;
